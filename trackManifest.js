// ONLY function body

const parsedUrl = new URL(url);
const id = parsedUrl.pathname.split('/').pop();
const query = parsedUrl.searchParams.toString();

const newUrl = `${ctx.localStorage.getItem('streamurl')}/trackManifests/?id=${id}&${query}`;

const res = await ctx.fetch(newUrl);
const data = await res.json();

return new Response(JSON.stringify(data.data), {
    status: res.status,
    statusText: res.statusText,
    headers: res.headers
});
