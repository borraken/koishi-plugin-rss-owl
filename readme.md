# koishi-plugin-rss-owl

[![npm](https://img.shields.io/npm/v/koishi-plugin-rss-owl?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-rss-owl)

rss-owl 是一个基于[koishi](https://koishi.chat/manual/starter/)的RSS订阅工具

## 使用方法

### 1. 基本使用
```
//对于rsshub订阅，可以使用快速链接以方便写入订阅和随时切换rsshub实例地址
//快速链接的列表及使用方法通过 rsso -q 查询
//每天60s早报
rsso https://hub.slarker.me/qqorw
rsso rss:qqorw
//微信公众号话题tag 看理想|李想主义 
rsso https://hub.slarker.me/wechat/mp/msgalbum/MzA3MDM3NjE5NQ==/1375870284640911361
rsso mp-tag:MzA3MDM3NjE5NQ==/1375870284640911361
//豆瓣小组-可爱事物分享
rsso https://hub.slarker.me/douban/group/648102
rsso rss:douban/group/648102

//(以下链接可能需要配置proxy才能显示完整内容)
//telegram每日沙雕墙
rsso https://hub.slarker.me/telegram/channel/woshadiao
rsso tg:woshadiao
//telegram rvalue的生草日常
rsso https://hub.slarker.me/telegram/channel/rvalue_daily
rsso tg:rvalue_daily
//koishi issue
rsso gh:issue/koishijs/koishi
//阮一峰的网络日志
rsso http://feeds.feedburner.com/ruanyifeng

//链接组可以将多个链接的推送合并，方便管理，订阅时最好同时提供订阅名称以方便查询
rsso -t 订阅组名称 <url>|<url>|<url>...
```
你可以在[RSSHub](https://docs.rsshub.app/zh/routes/popular)中找到需要的链接

并在[RSSHub公共实例](https://docs.rsshub.app/zh/guide/instances)中寻找替换可用的实例

当然，自己部署也是可以的

部分博客或论坛等网站也会主动提供RSS订阅链接，但本插件暂不支持旧版RSS格式

部分订阅不提供pubDate，导致插件无法判断，你需要使用 --daily 或refresh,forceLength 以在固定时间获取固定数量的更新，或者用 -p 随时取用最新的更新



### 2. 参数说明

#### template
模板提供了对推送内容的展示方式
在一般情况下，content模板用于少量文字图片的订阅
而default或custom模板用于含有大量文字图片的订阅
```
rsso -i custom <url>
```

#### arg
arg 可以写入局部参数，这会在使用该订阅时覆盖掉插件配置而不会影响其他订阅

支持的参数有[merge|forceLength|reverse|timeout|refresh|maxRssItem|firstLoad|bodyWidth|bodyPadding|proxyAgent|auth]

```
// 强制使用合并消息（false为强制不使用）
rsso -a merge:true <url>

// 关闭代理
rsso -a proxyAgent:false <url>

//添加代理
rsso -a proxyAgent:http//127.0.0.1/7890,auth:username/password <url>

//forceLength和refresh的组合可以让你订阅一些不提供更新时间的订阅，如排行榜
//发送最新10条消息，每日更新1次
rsso -a forceLength:10,refresh:1440 <url>


```

#### daily
指定该订阅每天更新时间和更新条数

```
//每日早8点推送10条最新内容
rsso -d 8:00/10 <url>
//每日早10点推送1条最新内容
rsso -d 10:00 <url>

```

##### todu
- [x] 稳定使用
- [x] 快速订阅功能
- [x] 视频本地转发功能
- [ ] 对返回磁链的订阅自动下载压缩发送

## 致谢:

- [koishi-plugin-rss](https://github.com/koishijs/koishi-plugin-rss)
- [koishi-plugin-rss-discourse](https://github.com/MirrorCY/koishi-plugin-rss)
- [koishi-plugin-rss-cat](https://github.com/jexjws/koishi-plugin-rss-cat)