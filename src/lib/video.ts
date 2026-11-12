// Turn a video page URL into an embeddable player URL, for the sites we can play inline.
export interface VideoEmbed {
  src: string;
  site: string;
}

export function videoEmbed(url: string): VideoEmbed | undefined {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return undefined;
  }
  const host = u.hostname.replace(/^(www|m)\./, '');

  // https://www.bilibili.com/video/BV.../?p=2   or   /video/av12345
  if (host === 'bilibili.com') {
    const m = u.pathname.match(/\/video\/(BV[0-9A-Za-z]+|av\d+)/i);
    if (!m) return undefined;
    const id = m[1];
    const params = new URLSearchParams({ p: u.searchParams.get('p') ?? '1', autoplay: '0', danmaku: '0', high_quality: '1' });
    if (/^BV/i.test(id)) params.set('bvid', id);
    else params.set('aid', id.slice(2));
    return { src: `https://player.bilibili.com/player.html?${params}`, site: 'bilibili' };
  }

  // Princeton Media Central (Kaltura): https://mediacentral.princeton.edu/media/<title>/1_xxxxxxxx
  if (host === 'mediacentral.princeton.edu') {
    const m = u.pathname.match(/\/(?:media|id)\/(?:[^/]+\/)?(\d_[0-9a-z]{8})/i);
    if (!m) return undefined;
    return {
      src: `https://cdnapisec.kaltura.com/p/1449362/embedPlaykitJs/uiconf_id/52003512?iframeembed=true&entry_id=${m[1]}`,
      site: 'Media Central',
    };
  }

  // https://www.youtube.com/watch?v=ID   or   https://youtu.be/ID
  if (host === 'youtube.com' || host === 'youtu.be') {
    const id = host === 'youtu.be' ? u.pathname.slice(1) : u.searchParams.get('v');
    if (!id) return undefined;
    return { src: `https://www.youtube-nocookie.com/embed/${id}`, site: 'YouTube' };
  }

  return undefined;
}
