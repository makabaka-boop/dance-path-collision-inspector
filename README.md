# 舞台轨迹检查 · Stage Trajectory Check

空仓库排练标记上的舞者轨迹冲突检查页：Vue 3 + TypeScript 单页应用，几何判定全部使用
整数 / 分数（BigInt 有理数）精确求解，**不以逐帧截图、SVG 像素或时间采样近似**。

## 判定模型

- 一次编排 2–8 名舞者；每人 2–25 个路点，时间为严格递增整数（0–600），
  坐标为整数且 |x|、|y| ≤ 100，安全半径为非负整数。
- 相邻路点之间**匀速直线运动**：位置是时间的有理线性函数。
- 对每对舞者，枚举时间区间重叠的线段对（闭区间，包含端点相接的零长度重叠）。
- 重叠段上相对位置 `r(s) = r0 + v·s`，相对距离平方是二次函数
  `|r(s)|² = (v·v)s² + 2(r0·v)s + (r0·r0)`；顶点
  `s* = -(r0·v)/(v·v)` 夹到重叠区间 `[0, end-start]`（v·v=0 时距离恒定）。
- 最小值 `min d²` 与发生时刻 `tMin` 均为约分分数（BigInt 分子/分母）；
  当 `min d² ≤ (r₁+r₂)²`（等号算冲突）即记一条冲突，逐对列出冲突线段、
  最小距离平方与发生时刻的精确分数。

擦边相切、相向相遇（整数与分数时刻）、端点零长度相接均有测试覆盖；
随机小样本还用双精度稠密采样（每段 20000 点）和朴素双层枚举做分段对拍。

## 页面联动

- 舞台 SVG 画全部轨迹、路点、当前时刻舞者位置与安全半径圈；
- 时间滑块（0.01s 精度，可播放）联动舞者位置；
- 冲突列表逐对分组，点击任一条：高亮涉及的两条线段、在最近点画两个舞者的
  **见证**连线、滑块跳到 `tMin`（精确分数四舍五入到 0.01s）；
  舞台上的星形标记反向选中同一冲突；
- 滑块轨道上标出所有冲突时刻，便于发现“两帧之间”的冲突；
- 编辑舞者 / 路点 / 半径后立即重新校验与分析：每次编辑递增**版本号**，
  分析在 Web Worker 中运行，旧版本返回的结果按版本号丢弃；
  Worker 不可用时自动回退主线程同步计算。

## 开发

```bash
npm ci
npm run dev       # Vite 开发服务器 http://localhost:5173
npm test          # Vitest：分数、几何判定、小样本枚举分段对拍
npm run build     # vue-tsc 类型检查 + 生产构建
```

## Docker Compose（stage 页面）

```bash
docker compose up --build -d        # http://localhost:8080
docker compose --profile test run --rm tests   # 容器内跑 Vitest
```

`stage` 服务构建静态产物并用 nginx 在 8080 提供；`tests` 服务（test profile）
运行几何测试。

## 目录

```
src/
  geometry/fraction.ts        # BigInt 有理数：四则、比较、取整、分数渲染
  geometry/types.ts           # 舞者 / 路点 / 重叠 / 冲突 / 结果类型
  geometry/geometry.ts        # 重叠枚举 + 二次函数精确最小值 + 冲突分析
  choreography/validation.ts  # 2–8 人、2–25 路点、时间/坐标/半径约束
  workers/analysis.worker.ts  # 版本化的分析 Worker
  composables/useAnalysis.ts  # 版本号丢弃旧结果、Worker 生命周期与回退
  components/                 # StageView / TimeSlider / CollisionList / DancerEditor
tests/
  fraction.test.ts        # 有理数边界（负数取整、大数精确比较、舍入）
  geometry.test.ts        # 擦边、反向相遇、端点相接、夹断、等速平行
  differential.test.ts    # 小样本枚举：双指针对拍朴素枚举、稠密采样对拍、
                          # 逐帧漏报演示（t=16/3 接触但整数帧全部 miss）
```
