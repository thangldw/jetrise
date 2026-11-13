export default {
  async fetch(request) {
    const path = new URL(request.url).pathname;
    if (!['/health', '/version'].includes(path)) return new Response('Not found', {status:404});
    if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', {status:405,headers:{Allow:'GET, HEAD'}});
    return new Response(request.method==='HEAD'?null:JSON.stringify({service:'jetrise',release:'2026.10.23-jet208',status:'ok',saveMode:'browser-local',web:'https://thangldw.github.io/jetrise/'}),{headers:{'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':'https://thangldw.github.io','X-Content-Type-Options':'nosniff'}});
  }
};
