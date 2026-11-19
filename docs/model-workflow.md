# 模型处理与检查

当前项目以仓库中的毛坯房模型进行功能测试。以下脚本针对这套模型的对象命名、坐标与静态网格结构编写，更换户型时需要同步调整筛选规则和表面映射。

## 模型文件

| 文件 | 内容 |
| --- | --- |
| `main-model.glb` | 原始扫描整理模型，约 66 MB，处理过程保留原文件 |
| `public/models/apartment.glb` | 提取后的底座，保留 21 段墙体、8 块地板，移除原始扫描件、重复网格与原贴图 |
| `model-repair/apartment-repaired.blend` | 门洞及墙顶修复后的 Blender 文件 |
| `public/models/apartment-repaired.glb` | 5 号房通向 2 号过道增加 0.85 × 2.10 米门洞，墙高统一为 2.60 米 |
| `model-repair/apartment-clean.blend` | 墙端裁齐后的 Blender 文件，用于继续修改 |
| `public/models/apartment-clean.glb` | 网页当前使用的版本，裁齐 7 处墙端凸出，并校正墙面的微小倾斜 |

天花板在网页中根据地板和墙顶生成，不写入底座 GLB；导出装修模型时会包含可见天花板。遮光使用单独的厚板，保持自由视角可编辑，同时减少接缝漏光。

## 材质与旧方案兼容

编辑器按三角面的法线和位置将网格分组，同一墙体的两侧可以分别设置材质。纹理采用以米为基准的世界坐标铺贴，不依赖原始 UV；平面分组与房间分区并不是同一套数据。

修复模型会改变部分表面编号。`map-surfaces.mjs` 和 `map-clean-surfaces.mjs` 写入旧表面到新表面的映射，`src/model-migration.js` 在打开方案时迁移，保留已有材质、家具和日照；新增表面使用默认材质。

这种兼容针对仓库中已有的模型版本，不保证任意新模型都能恢复旧方案。

## 重新生成

在项目根目录执行，需要 Python、Blender，以及已经安装的项目依赖。`blender` 可替换为本机 Blender 可执行文件的路径。

1. 提取原始模型中的墙体和地板：

   ```bash
   python3 scripts/prepare-model.py
   ```

2. 根据 `model-repair/repair-config.json` 修复墙高和门洞，并生成表面映射：

   ```bash
   blender --background --python model-repair/repair-model.py
   node model-repair/map-surfaces.mjs public/models/apartment.glb model-repair/apartment-repaired.glb
   cp model-repair/apartment-repaired.glb public/models/apartment-repaired.glb
   ```

3. 裁齐墙端，校正微小偏斜，生成最终映射：

   ```bash
   blender --background --python model-repair/trim-junctions.py
   node model-repair/map-clean-surfaces.mjs
   ```

4. 检查通过后，更新网页底座：

   ```bash
   node model-repair/check-repair.mjs
   node model-repair/check-clean.mjs
   cp model-repair/apartment-clean.glb public/models/apartment-clean.glb
   ```

`prepare-model.py` 只更新未修复的提取底座，不会替代后续步骤。更换源文件或修改房间结构后，应重新核对门窗、墙面编号和旧方案兼容情况。

## 检查脚本

| 命令 | 检查范围 |
| --- | --- |
| `node model-repair/check-repair.mjs` | 墙顶高度、门洞通行、过梁与原方案表面映射 |
| `node model-repair/check-clean.mjs` | 墙体横平竖直、地板边界、门洞与旧方案迁移 |
| `node model-repair/check-interior.mjs` | 天花板覆盖、灯具开关与恢复、房间归属、批量操作、反弹光和自然光逻辑 |

这些检查不启动浏览器，也不能代替实际画面与性能检查。
