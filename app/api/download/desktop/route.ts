import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60s for large file streaming

// GitHub Release asset details for private repo download proxy
const GITHUB_REPO = 'rameez-hash/BMDHRMS';
const RELEASE_TAG = 'v1.4.0';

const ASSETS: Record<string, { name: string; mime: string }> = {
  win: { name: 'BMD.HRMS.Setup.1.4.0.exe', mime: 'application/x-msdownload' },
  mac: { name: 'BMD.HRMS-1.4.0.dmg', mime: 'application/x-apple-diskimage' },
};

export async function GET(request: NextRequest) {
  try {
    const platform = request.nextUrl.searchParams.get('platform') || 'win';
    const assetInfo = ASSETS[platform] || ASSETS.win;

    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      return NextResponse.json({ error: 'Download not configured' }, { status: 503 });
    }

    // Get release info to find the asset
    const releaseRes = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases/tags/${RELEASE_TAG}`,
      {
        headers: {
          Authorization: `token ${githubToken}`,
          Accept: 'application/vnd.github+json',
        },
      }
    );

    if (!releaseRes.ok) {
      return NextResponse.json({ error: 'Release not found' }, { status: 404 });
    }

    const release = await releaseRes.json();
    const asset = release.assets?.find((a: { name: string }) => a.name === assetInfo.name);

    if (!asset) {
      return NextResponse.json({ error: 'Asset not found. Build may still be in progress.' }, { status: 404 });
    }

    // Get the download URL by following GitHub's redirect
    const assetRes = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases/assets/${asset.id}`,
      {
        headers: {
          Authorization: `token ${githubToken}`,
          Accept: 'application/octet-stream',
        },
        redirect: 'manual',
      }
    );

    const redirectUrl = assetRes.headers.get('location');
    if (!redirectUrl) {
      return NextResponse.json({ error: 'Download failed' }, { status: 500 });
    }

    // Stream the file through our domain (avoids browser virus scan issues with 3rd-party redirects)
    const fileRes = await fetch(redirectUrl);
    if (!fileRes.ok || !fileRes.body) {
      return NextResponse.json({ error: 'Download failed' }, { status: 500 });
    }

    return new NextResponse(fileRes.body as ReadableStream, {
      headers: {
        'Content-Type': assetInfo.mime,
        'Content-Disposition': `attachment; filename="${assetInfo.name}"`,
        'Content-Length': String(asset.size),
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json({ error: 'Download failed' }, { status: 500 });
  }
}
