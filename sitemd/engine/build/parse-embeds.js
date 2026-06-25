function wrapEmbed(src, cls) {
  return `<div class="embed ${cls}"><iframe src="${src}" frameborder="0" allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" loading="lazy"></iframe></div>\n`;
}

function buildEmbedHtml(url) {
  // YouTube
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
  if (ytMatch) return wrapEmbed(`https://www.youtube.com/embed/${ytMatch[1]}`, 'embed--video');

  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return wrapEmbed(`https://player.vimeo.com/video/${vimeoMatch[1]}`, 'embed--video');

  // X / Twitter
  const tweetMatch = url.match(/(?:twitter|x)\.com\/\w+\/status\/(\d+)/);
  if (tweetMatch) return wrapEmbed(`https://platform.twitter.com/embed/Tweet.html?dnt=true&id=${tweetMatch[1]}`, 'embed--tweet');

  // Reddit — native widget via embed.reddit.com/widgets.js
  const redditMatch = url.match(/(?:www\.)?reddit\.com(\/r\/\w+\/comments\/[\w]+[\w\-\/]*)/);
  if (redditMatch) {
    const redditUrl = `https://www.reddit.com${redditMatch[1]}`;
    return `<div class="embed embed--reddit"><blockquote class="reddit-embed-bq" data-embed-height="500"><a href="${redditUrl}">View on Reddit</a></blockquote></div>\n`;
  }

  // Instagram
  const igMatch = url.match(/(?:www\.)?instagram\.com\/(p|reel)\/([\w-]+)/);
  if (igMatch) return wrapEmbed(`https://www.instagram.com/${igMatch[1]}/${igMatch[2]}/embed/`, 'embed--instagram');

  // LinkedIn — supports /posts/user-activity-ID and /embed/feed/update/urn:li:*
  const liEmbedMatch = url.match(/linkedin\.com\/embed\/feed\/update\/(urn:li:\w+:\d+)/);
  if (liEmbedMatch) return wrapEmbed(`https://www.linkedin.com/embed/feed/update/${liEmbedMatch[1]}`, 'embed--linkedin');
  const liPostMatch = url.match(/linkedin\.com\/posts\/[\w-]+-activity-(\d+)/);
  if (liPostMatch) return wrapEmbed(`https://www.linkedin.com/embed/feed/update/urn:li:activity:${liPostMatch[1]}`, 'embed--linkedin');

  // TikTok
  const tiktokMatch = url.match(/(?:www\.)?tiktok\.com\/@[\w.]+\/video\/(\d+)/);
  if (tiktokMatch) return wrapEmbed(`https://www.tiktok.com/embed/v2/${tiktokMatch[1]}`, 'embed--tiktok');

  // Spotify
  const spotifyMatch = url.match(/open\.spotify\.com\/(track|album|playlist|episode)\/([\w]+)/);
  if (spotifyMatch) return wrapEmbed(`https://open.spotify.com/embed/${spotifyMatch[1]}/${spotifyMatch[2]}`, 'embed--spotify');

  // CodePen
  const codepenMatch = url.match(/codepen\.io\/([\w-]+)\/pen\/([\w]+)/);
  if (codepenMatch) return wrapEmbed(`https://codepen.io/${codepenMatch[1]}/embed/${codepenMatch[2]}?default-tab=result`, 'embed--codepen');

  // Image
  if (/\.(png|jpe?g|gif|webp|avif|svg)(\?.*)?$/i.test(url)) {
    return `<img src="${url}" alt="" loading="lazy">\n`;
  }

  // Generic fallback
  return wrapEmbed(url, 'embed--video');
}

module.exports = { wrapEmbed, buildEmbedHtml };
