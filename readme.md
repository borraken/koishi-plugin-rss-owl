# koishi-plugin-rss-owl

[![npm](https://img.shields.io/npm/v/koishi-plugin-rss-owl?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-rss-owl)

rss-owl 是一个基于[koishi](https://koishi.chat/manual/starter/)的RSS订阅工具

## 使用方法

### 1. 基本使用
```
rsso 需要订阅的链接或链接组
//如:

//微信公众号话题tag 看理想|李想主义 
rsso https://hub.slarker.me/wechat/mp/msgalbum/MzA3MDM3NjE5NQ==/1375870284640911361
//豆瓣小组-可爱事物分享
rsso https://rsshub.rssforever.com/douban/group/648102
//每天60s
rsso https://hub.slarker.me/qqorw

//(以下链接可能需要配置proxy才能显示完整内容)
//telegram每日沙雕墙
rsso https://rsshub.rssforever.com/telegram/channel/woshadiao
//阮一峰的网络日志
rsso http://feeds.feedburner.com/ruanyifeng

//链接组可以将多个链接的推送合并，方便管理
rsso <url>|<url>|<url>...
```
你可以在[RSSHub](https://docs.rsshub.app/zh/routes/popular)中找到需要的链接

并在[RSSHub公共实例](https://docs.rsshub.app/zh/guide/instances)中寻找替换可用的实例

当然，自己部署也是可以的

部分博客或论坛等网站也会主动提供RSS订阅链接，但本插件并不支持旧版RSS格式

部分链接不提供pubDate，导致插件无法比较更新时间，你需要使用 --daily 或refresh,forceLength 以在固定时间获取固定数量的更新，或者用 -p 随时取用最新的更新



### 2. 参数说明

#### template
```
rsso -i custom <url>
```

#### arg
arg 可以写入局部参数，这会在使用该订阅时覆盖掉插件配置而不会影响其他订阅

支持的参数[merge|forceLength|reverse|timeout|refresh|merge|maxRssItem|firstLoad|bodyWidth|bodyPadding|custom|proxyAgent|auth|filter|block]

插件配置中大部分选项都可以在此修改

有forceLength的情况下每次获取订阅都会发送最新的几条消息

参数reverse会在订阅有多条更新时反向发送更新

```
// 关闭代理，并使用custom
rsso -a proxyAgent:false,rssItem:custom <url>

//添加代理
rsso -a proxyAgent:http//127.0.0.1/7890,auth:username/password <url>

//forceLength和refresh的组合可以让你订阅一些不提供更新时间的订阅，如排行榜
//发送最新10条消息，每日更新1次
rsso -a forceLength:10,refresh:1440 <url>

//custom和domFrame都可以对订阅自定义
//domFrame仅对description生效，不允许写入title等key
rsso -a domFrame:{{description}} <url>

//custom容易发生错误，请尽量避免使用，使用时`&nbsp;`代替空格以避免koishi解析错误
rsso -i custom -C <div&nbsp;style='width:600px'>{{description}}</div> <url>
```

#### keyword-filter
关键字过滤，会与配置中的进行合并
```
rsso -k nsfw,something <url>
```

#### template
[content|text|image|video|proto|default|description|custom|link]
不同的模板有不同的处理方式
最常用的content,default,custom
content是最基础的模板，无需pptr，图文都可以显示
default是包含了title等信息的pptr模板
custom模板可以自定义内容，相当于强化版default，在默认值中，我展示了订阅的部分信息，并使用了护眼的背景色
text,image,video,proto都是根据description做处理,用于在一些简单的订阅中尽可能精简信息
link用于一些返回链接的订阅，例如：[华尔街日报(电报频道)](https://rsshub.app/telegram/channel/wsj_rss)，效果类似于description

```
rsso -i content <url>
```

#### title
自定义名称，一般配合链接组进行使用
```
rsso -t 订阅名称 <url>
```

#### force
强行写入而不仅过验证，因此，订阅时最后一次更新不会被推送，同时也获取不到订阅名称

#### test
测试链接，不会写入订阅

```
rsso -T <url>
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
- [ ] 稳定使用
- [x] 快速订阅功能
- [ ] 视频本地转发功能
- [ ] 对返回磁链的订阅自动下载压缩发送

## 致谢:

- [koishi-plugin-rss](https://github.com/koishijs/koishi-plugin-rss)
- [koishi-plugin-rss-discourse](https://github.com/MirrorCY/koishi-plugin-rss)
- [koishi-plugin-rss-cat](https://github.com/jexjws/koishi-plugin-rss-cat)