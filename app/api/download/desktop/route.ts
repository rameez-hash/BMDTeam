import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60s for large file streaming

const GITHUB_REPO = 'rameez-hash/BMDHRMS';
const DESKTOP_VERSION = '1.9.1';
const RELEASE_TAG = `v${DESKTOP_VERSION}`;

type AssetInfo = { releaseTag: string; name: string; mime: string };

const PLATFORM_ASSETS: Record<string, AssetInfo & { fallback?: AssetInfo }> = {
  win: {
    releaseTag: RELEASE_TAG,
    name: `BMD-HRMS-Setup-${DESKTOP_VERSION}.exe`,
    mime: 'application/x-msdownload',
  },
  mac: {
    releaseTag: RELEASE_TAG,
    name: `BMD-HRMS-${DESKTOP_VERSION}.dmg`,
    mime: 'application/x-apple-diskimage',
  },
};

async function fetchReleaseAsset(
  assetInfo: AssetInfo,
  githubToken: string
): Promise<{ asset: { id: number; size: number }; releaseTag: string; name: string; mime: string } | null> {
  const releaseRes = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/releases/tags/${assetInfo.releaseTag}`,
    {
      headers: {
        Authorization: `token ${githubToken}`,
        Accept: 'application/vnd.github+json',
      },
    }
  );

  if (!releaseRes.ok) return null;

  const release = await releaseRes.json();
  const asset = release.assets?.find((a: { name: string }) => a.name === assetInfo.name);
  if (!asset) return null;

  return {
    asset,
    releaseTag: assetInfo.releaseTag,
    name: assetInfo.name,
    mime: assetInfo.mime,
  };
}

export async function GET(request: NextRequest) {
  try {
    const platform = request.nextUrl.searchParams.get('platform') || 'win';
    const config = PLATFORM_ASSETS[platform] || PLATFORM_ASSETS.win;

    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      return NextResponse.json({ error: 'Download not configured' }, { status: 503 });
    }

    let resolved = await fetchReleaseAsset(config, githubToken);
    if (!resolved && config.fallback) {
      resolved = await fetchReleaseAsset(config.fallback, githubToken);
    }

    if (!resolved) {
      const msg =
        platform === 'mac'
          ? 'Mac installer not found yet. Run GitHub Actions “Build Desktop App” for macOS, or try again shortly.'
          : 'Installer not found. Build may still be in progress.';
      return NextResponse.json({ error: msg }, { status: 404 });
    }

    const assetRes = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases/assets/${resolved.asset.id}`,
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

    const fileRes = await fetch(redirectUrl);
    if (!fileRes.ok || !fileRes.body) {
      return NextResponse.json({ error: 'Download failed' }, { status: 500 });
    }

    return new NextResponse(fileRes.body as ReadableStream, {
      headers: {
        'Content-Type': resolved.mime,
        'Content-Disposition': `attachment; filename="${resolved.name}"`,
        'Content-Length': String(resolved.asset.size),
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json({ error: 'Download failed' }, { status: 500 });
  }
}
