# ArXiv 翻译前端

这是个人主页中的静态入口页面。翻译任务和历史数据保存在 Mac mini 后端，不会写入这个 GitHub Pages 仓库。

任务完成后可以打开中文 PDF，也可以进入对照阅读页面，同时查看原文 arXiv PDF 和中文译文 PDF。

部署前，在 `config.js` 填入后端的 HTTPS 地址：

```js
window.ARXIV_API_BASE = 'https://your-translator-api.example.com';
```

后端需要允许个人主页域名的跨域请求，并通过 HTTPS 提供访问。
