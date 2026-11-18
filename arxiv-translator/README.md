# ArXiv 翻译前端

这是个人主页中的静态入口页面。翻译任务和历史数据保存在 Mac mini 后端，不会写入这个 GitHub Pages 仓库。

部署前，在 `config.js` 填入后端的 HTTPS 地址：

```js
window.ARXIV_API_BASE = 'https://your-translator-api.example.com';
```

后端需要允许个人主页域名的跨域请求，并通过 HTTPS 提供访问。
