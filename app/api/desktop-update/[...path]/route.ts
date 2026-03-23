import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const GITHUB_REPO = 'rameez-hash/BMDHRMS';

async function getGitHubDownloadUrl(fileName: string, githubToken: string) {
  const releasesRes = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=5`,
    {
      headers: {
        Authorization: `token ${githubToken}`,
        Accept: 'application/vnd.github+json',
      },
      cache: 'no-store',
    }
  );

  if (!releasesRes.ok) return null;
  const releases = await releasesRes.json();

  let asset = null;
  for (const rel of releases) {
    asset = rel.assets?.find((a: { name: string }) => a.name === fileName);
    if (asset) break;
  }
  if (!asset) return null;

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
  return { redirectUrl, size: asset.size };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const fileName = path.join('/');
  const githubToken = process.env.GITHUB_TOKEN;

  if (!githubToken) {
    return NextResponse.json({ error: 'Server config error' }, { status: 500 });
  }

  try {
    const result = await getGitHubDownloadUrl(fileName, githubToken);
    if (!result || !result.redirectUrl) {
      return NextResponse.json(
        { error: `Asset "${fileName}" not found` },
        { status: 404 }
      );
    }

    const { redirectUrl, size } = result;
    const isYml = fileName.endsWith('.yml');
    const isExe = fileName.endsWith('.exe') && !fileName.endsWith('.blockmap');

    if (isExe) {
      const rangeHeader = request.headers.get('range');

      if (rangeHeader) {
        const fileRes = await fetch(redirectUrl, {
          headers: { Range: rangeHeader },
        });

        return new NextResponse(fileRes.body as ReadableStream, {
          status: fileRes.status,
          headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Length': fileRes.headers.get('content-length') || String(size),
            'Content-Range': fileRes.headers.get('content-range') || '',
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'public, max-age=3600',
          },
        });
      }

      const fileRes = await fetch(redirectUrl);
      if (!fileRes.ok || !fileRes.body) {
        return NextResponse.json({ error: 'Download failed' }, { status: 502 });
      }

      return new NextResponse(fileRes.body as ReadableStream, {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Length': String(size),
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    const fileRes = await fetch(redirectUrl);
    if (!fileRes.ok || !fileRes.body) {
      return NextResponse.json({ error: 'Download failed' }, { status: 502 });
    }

    const contentType = isYml ? 'text/yaml; charset=utf-8' : 'application/octet-stream';

    return new NextResponse(fileRes.body as ReadableStream, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(size),
        'Cache-Control': isYml ? 'no-cache' : 'public, max-age=3600',
        'Accept-Ranges': 'bytes',
      },
    });
  } catch (err) {
    console.error('desktop-update proxy error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
