import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const GITHUB_REPO = 'rameez-hash/BMDHRMS';

/**
 * Proxy for electron-updater (generic provider).
 * Serves latest.yml, exe, and blockmap from the LATEST GitHub release.
 * This lets a private repo work with auto-update without exposing tokens.
 *
 * electron-updater requests:
 *   GET /api/desktop-update/latest.yml
 *   GET /api/desktop-update/BMD-HRMS-Setup-x.x.x.exe
 *   GET /api/desktop-update/BMD-HRMS-Setup-x.x.x.exe.blockmap
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const fileName = path.join('/');
  const githubToken = process.env.GITHUB_TOKEN;

  if (!githubToken) {
    return NextResponse.json({ error: 'Server config error' }, { status: 500 });
  }

  try {
    // Always fetch the LATEST release (no hardcoded tag needed)
    const releaseRes = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
      {
        headers: {
          Authorization: `token ${githubToken}`,
          Accept: 'application/vnd.github+json',
        },
        next: { revalidate: 300 }, // cache 5 min
      }
    );

    if (!releaseRes.ok) {
      return NextResponse.json({ error: 'Release not found' }, { status: 404 });
    }

    const release = await releaseRes.json();
    const asset = release.assets?.find((a: { name: string }) => a.name === fileName);

    if (!asset) {
      return NextResponse.json(
        { error: `Asset "${fileName}" not found in release ${release.tag_name}` },
        { status: 404 }
      );
    }

    // Get the download redirect URL from GitHub
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
      return NextResponse.json({ error: 'Download redirect failed' }, { status: 500 });
    }

    // Stream file content
    const fileRes = await fetch(redirectUrl);
    if (!fileRes.ok || !fileRes.body) {
      return NextResponse.json({ error: 'Download failed' }, { status: 502 });
    }

    const isYml = fileName.endsWith('.yml');
    const contentType = isYml ? 'text/yaml; charset=utf-8' : 'application/octet-stream';

    return new NextResponse(fileRes.body as ReadableStream, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(asset.size),
        'Cache-Control': isYml ? 'no-cache' : 'public, max-age=3600',
      },
    });
  } catch (err) {
    console.error('desktop-update proxy error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
