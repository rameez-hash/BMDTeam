import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// GitHub Release asset details for private repo download proxy
const GITHUB_REPO = 'rameez-hash/BMDHRMS';
const RELEASE_TAG = 'v1.0.0';
const ASSET_NAME = 'BMD.HRMS.Setup.1.0.0.exe';

export async function GET() {
  try {
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
    const asset = release.assets?.find((a: { name: string }) => a.name === ASSET_NAME);

    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    // Request the asset with octet-stream accept header → GitHub returns 302 redirect to a temporary public S3 URL
    const assetRes = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases/assets/${asset.id}`,
      {
        headers: {
          Authorization: `token ${githubToken}`,
          Accept: 'application/octet-stream',
        },
        redirect: 'manual', // Don't follow redirect, we'll send it to client
      }
    );

    // GitHub returns 302 with a temporary signed URL that's publicly accessible
    const redirectUrl = assetRes.headers.get('location');
    if (redirectUrl) {
      return NextResponse.redirect(redirectUrl);
    }

    // Fallback: if no redirect, stream the response
    if (assetRes.ok && assetRes.body) {
      return new NextResponse(assetRes.body as ReadableStream, {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${ASSET_NAME}"`,
          'Content-Length': String(asset.size),
        },
      });
    }

    return NextResponse.json({ error: 'Download failed' }, { status: 500 });
  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json({ error: 'Download failed' }, { status: 500 });
  }
}
