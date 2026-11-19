# 装修示意用低面家具调研

日期：2026-11-18。目标是摆放家具、比较空间布局，不追求写实。此次仅调研，未接入或更改素材库。

## 结论

优先采用 KayKit Furniture Bits 免费版，Kenney Furniture Kit 作为补充候选。家具按米校准宽、深、高，比贴图写实程度更重要。统一一套模型为主体，避免从多个单件平台拼接造成比例与风格不一致。

## 对比

| 来源 | 内容及格式 | 授权证据 | 适配判断 |
| --- | --- | --- | --- |
| KayKit Furniture Bits | 官网标注 50+；官方 GitHub 实测 53 个 glTF；床、沙发、桌椅、边柜、架子、地毯、灯、装饰 | 官方仓库 LICENSE.txt 和 README 均标注 CC0；个人与商业项目可用 | 主库。轻量、统一、已有 glTF，转换为 GLB 后可接现有加载器 |
| Kenney Furniture Kit | 官方标注 140 个文件 / 素材；具体模型格式和面数本轮未实测 | 官方页面 CC0 | 补充候选。需下载成功后检查具体缺项与比例，不把官方数量当作 140 件不同大件家具 |
| KayKit Restaurant Bits 免费版 | 官方标注 140+ 厨房及食品模型，含 OBJ、FBX、glTF | 官方页面 CC0 | 后期只挑厨房大件；食品、食材状态和烹饪道具不应全部加入装修库 |
| Quaternius Furniture Pack | 旧家具页标注 23 个模型，FBX、OBJ、Blend | 该页仍写 CC0，现行总站授权页为 QAL，含素材再分发限制 | 暂不优先，具体下载版本与随包授权需要核对，不能把整个站称为 CC0 |

## KayKit 官方 GitHub 包实测

来源：https://github.com/KayKit-Game-Assets/KayKit-Furniture-Bits-1.0
下载：官方仓库 main 分支 ZIP。没有运行下载内容，仅解析 glTF accessor 和文件资源。

- 53 个 glTF 模型，另带二进制数据和纹理。
- 44～1,018 个三角面 / 模型，中位数 216。
- 沙发 couch：636 三角面；带靠枕版本：808。
- 双人床 bed_double_A / B：540 / 600。
- 桌子 table_medium：168；茶几 table_low：276。
- 椅子 chair_A：308。
- 中柜 cabinet_medium：428；带装饰版本：1,018。
- 所有 glTF、它们引用的 bin 和去重后的贴图资源合计 864,750 字节，约 0.83 MiB。该数值是解压后的相关资源总量，不是 GLB 转换后的实测结果。
- 官方 GitHub ZIP 为 667,531 字节；不等同于 itch 免费下载页的 3.6 MB 多格式包。
- 未做浏览器帧率测试，不将面数推算写成运行性能结论。

## 缺项与推荐首批

实际清单包含：双人床与单人床各两款、沙发、扶手椅、多种椅凳、四款桌子、中小柜、搁架、落地灯、台灯、地毯、靠枕、相框、书和仙人掌。

未见冰箱、马桶、浴缸、淋浴间、灶台、完整橱柜组合、大型衣柜、L 形沙发。需补充时先使用可设尺寸的示意块，或从风格相近的 CC0 包中挑选。

首批建议挑 20～25 件常用模型，按客厅、卧室、收纳、灯具、装饰分类。枕头、书、相框等变体不占主列表优先位置。

## 接入建议（尚未实施）

1. 使用本地 GLB，不依赖第三方实时接口；点选后按需加载并缓存。
2. 统一 Y 轴向上、原点在底部中心，校准米制尺寸。
3. 为每件家具记录中文名、分类、默认宽深高、来源、授权和缩略图。
4. 保留按实际宽深高调整的入口；例如同一床模型可设为 1.5 m 或 1.8 m 宽。
5. 统一模型颜色和缩略图视角，以形状、尺寸和类别帮助选择。
6. 同模型多次摆放复用几何与纹理。只有实测发现性能问题后再增加压缩或实例化复杂度。
7. glTF 转 GLB 应嵌入其引用的纹理与二进制资源；当前编辑器仅接受单文件 GLB 家具导入。

## 核验范围

Kenney 官网文字可读取，但官方网页与 ZIP 的终端下载均返回 403，所以未对其模型清单、包体或面数作实测承诺。KayKit 的实测来源为官方 GitHub 仓库，不是第三方整理包。

## 官方来源

- KayKit 家具说明：https://www.kaylousberg.com/game-assets/furniture-bits
- KayKit 家具下载及免费/付费范围：https://kaylousberg.itch.io/furniture-bits
- KayKit 官方仓库：https://github.com/KayKit-Game-Assets/KayKit-Furniture-Bits-1.0
- Kenney 家具：https://kenney.nl/assets/furniture-kit
- KayKit 厨房：https://kaylousberg.itch.io/restaurant-bits
- Quaternius 旧家具包：https://quaternius.com/packs/furniture.html
- Quaternius 当前授权：https://quaternius.com/license.html
