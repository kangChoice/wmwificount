# 版本管理规则

## 核心规则

**永远不要删除已存在的 tag。**

## 发版流程

```bash
# 1. 修改 package.json 中的 version 字段
#    例如从 1.0.3 → 1.0.4

# 2. 提交代码
git add -A
git commit -m "chore: bump version to 1.0.4"
git push

# 3. 打新标签（在旧版本号上加 1）
git tag v1.0.4
git push origin v1.0.4

# 4. GitHub Actions 自动构建
#    去 https://github.com/kangChoice/wmwificount/actions 看进度
```

## 禁止操作

| 操作 | 后果 | 允许？ |
|------|------|:------:|
| `git tag -d v1.0.x` | 删除旧标签 | ❌ **禁止** |
| `git push --delete origin v1.0.x` | 删除远程标签 | ❌ **禁止** |
| `git push origin v1.0.x --force` | 覆盖远程标签 | ❌ **禁止** |
| `git tag v1.0.4`（在 v1.0.4 已存在时） | 报错 "tag already exists" | ❌ 应使用 v1.0.5 |

## 版本号递增规则

```
v1.0.3 → 下次发版 → v1.0.4
v1.0.4 → 下次发版 → v1.0.5
v1.0.5 → 下次发版 → v1.0.6
...以此类推，永远只加不减
```
