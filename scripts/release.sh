#!/usr/bin/env bash
#
# release.sh — smh-mcp 发版脚本（内网 + 外网一体）
#
# 发布顺序（关键）：
#   ① npm version  改版本号 + commit + 打 tag
#   ② 发内网 @tencent/smh-mcp → mirrors.tencent.com（同步，失败立即终止）
#   ③ 推外网 tag 到 cnb → CNB 同步 GitHub → GitHub Actions OIDC 发布 smh-mcp
#
# 为什么这个顺序：内网是同步发布（立刻知道成败），外网是异步（推 tag 后 CI 才跑）。
# 先发内网验证成功，再推外网 tag；内网失败时 tag 未推出，外网不会发，可安全回滚。
#
# 用法：
#   bash scripts/release.sh                  # patch，内网+外网
#   bash scripts/release.sh minor            # minor，内网+外网
#   bash scripts/release.sh patch --skip-internal   # 只发外网
#   bash scripts/release.sh patch --internal-only   # 只发内网（不打 tag/不推外网）
#
# 或通过 npm: npm run release / npm run release minor

set -euo pipefail

# ---- 配置 ----
REMOTE="cnb"                                      # 外网同步用的远端
BRANCH="master"                                   # 发版分支
INTERNAL_NAME="@tencent/smh-mcp"                  # 内网包名
INTERNAL_REGISTRY="http://mirrors.tencent.com/npm/"  # 内网 registry
PUBLIC_NAME="smh-mcp"                             # 外网包名

# ---- 颜色输出 ----
red()   { printf "\033[31m%s\033[0m\n" "$1"; }
green() { printf "\033[32m%s\033[0m\n" "$1"; }
blue()  { printf "\033[34m%s\033[0m\n" "$1"; }

# ---- 解析参数 ----
BUMP="patch"
SKIP_INTERNAL=0
INTERNAL_ONLY=0
for arg in "$@"; do
  case "$arg" in
    patch|minor|major) BUMP="$arg" ;;
    --skip-internal)   SKIP_INTERNAL=1 ;;
    --internal-only)   INTERNAL_ONLY=1 ;;
    *) red "未知参数: ${arg}"; exit 1 ;;
  esac
done

# ---- 1. 必须在发版分支 ----
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "${CURRENT_BRANCH}" != "${BRANCH}" ]]; then
  red "当前在分支 '${CURRENT_BRANCH}'，发版必须在 '${BRANCH}' 分支。请先切换。"
  exit 1
fi

# ---- 2. 工作区必须干净 ----
if [[ -n "$(git status --porcelain)" ]]; then
  red "工作区有未提交的改动，请先提交或暂存后再发版："
  git status --short
  exit 1
fi

# ---- 3. 计算版本号 ----
CURRENT_VERSION="$(node -p "require('./package.json').version")"
NEXT_VERSION="$(node -e "
  const [maj,min,pat] = require('./package.json').version.split('.').map(Number);
  const t = process.argv[1];
  if (t==='major') console.log((maj+1)+'.0.0');
  else if (t==='minor') console.log(maj+'.'+(min+1)+'.0');
  else console.log(maj+'.'+min+'.'+(pat+1));
" "${BUMP}")"

# ---- 内网发布函数（内联，正确捕获失败 + 必恢复 package.json）----
publish_internal() {
  # 登录预检：未登录内网 registry 时友好提示并终止，避免后续 401 一堆报错
  if ! npm whoami --registry="${INTERNAL_REGISTRY}" >/dev/null 2>&1; then
    red "未登录内网 registry：${INTERNAL_REGISTRY}"
    red "请先登录后重试："
    echo "  npm login --registry=${INTERNAL_REGISTRY}"
    return 1
  fi
  green "→ 发布内网包 ${INTERNAL_NAME}@${NEXT_VERSION} → ${INTERNAL_REGISTRY}"
  cp package.json .package.json.bak
  # 失败/退出时务必恢复原始文件，避免把改名后的状态留在工作区
  trap 'mv -f .package.json.bak package.json 2>/dev/null || true' RETURN

  npm pkg set name="${INTERNAL_NAME}"
  # 内网私服可能较慢：拉长 npm 客户端超时(300s)并启用重试，避免传输中途超时失败
  if ! npm publish --registry="${INTERNAL_REGISTRY}" --fetch-timeout=300000 --fetch-retries=3; then
    red "内网发布失败！"
    return 1
  fi
  green "✓ 内网 ${INTERNAL_NAME}@${NEXT_VERSION} 发布成功"
  return 0
}

# ============ 模式 A：只发内网（不打 tag、不动 git）============
if [[ "${INTERNAL_ONLY}" -eq 1 ]]; then
  blue "==================== 仅发内网 ===================="
  echo "  包名     : ${INTERNAL_NAME}"
  echo "  当前版本 : ${CURRENT_VERSION}（不升级版本号）"
  echo "  registry : ${INTERNAL_REGISTRY}"
  blue "================================================="
  read -r -p "确认仅发布内网 ${INTERNAL_NAME}@${CURRENT_VERSION} 吗? [y/N] " ans
  [[ "${ans}" == "y" || "${ans}" == "Y" ]] || { red "已取消。"; exit 0; }
  NEXT_VERSION="${CURRENT_VERSION}"   # 不升级，用当前版本
  publish_internal
  green "✓ 完成（仅内网）。"
  exit 0
fi

# ============ 模式 B：标准发版（内网 + 外网）============
# 发版前置预检：需发内网时，先探内网 registry 登录态，避免打完 tag 才发现没登录
if [[ "${SKIP_INTERNAL}" -eq 0 ]]; then
  if ! npm whoami --registry="${INTERNAL_REGISTRY}" >/dev/null 2>&1; then
    red "未登录内网 registry：${INTERNAL_REGISTRY}"
    red "内网发布需先登录。请执行后重试（或加 --skip-internal 只发外网）："
    echo "  npm login --registry=${INTERNAL_REGISTRY}"
    exit 1
  fi
fi

blue "==================== 发版确认 ===================="
echo "  当前版本 : ${CURRENT_VERSION}"
echo "  升级类型 : ${BUMP}"
green "  目标版本 : ${NEXT_VERSION}  (tag v${NEXT_VERSION})"
if [[ "${SKIP_INTERNAL}" -eq 1 ]]; then
  echo "  内网发布 : 跳过 (--skip-internal)"
else
  echo "  内网发布 : ${INTERNAL_NAME} → ${INTERNAL_REGISTRY}"
fi
echo "  外网发布 : ${PUBLIC_NAME}（推 tag → GitHub Actions 自动发）"
echo "  推送到   : ${REMOTE}/${BRANCH}"
blue "================================================="
echo "  发布后不可撤销！内网先发(同步)，成功后再推外网 tag。"
read -r -p "确认要发布 v${NEXT_VERSION} 吗? [y/N] " ans
[[ "${ans}" == "y" || "${ans}" == "Y" ]] || { red "已取消，未做任何改动。"; exit 0; }

# ---- 步骤①：升级版本号 + commit + 打 tag ----
green "→ 升级版本号并打 tag v${NEXT_VERSION} ..."
npm version "${BUMP}" -m "chore(release): v%s"

# ---- 步骤②：先发内网（失败则终止，tag 已打但未推外网，可手动回滚）----
if [[ "${SKIP_INTERNAL}" -eq 0 ]]; then
  if ! publish_internal; then
    red "=================================================="
    red "内网发布失败，已终止。外网 tag 尚未推送，不会发布外网。"
    red "常见原因：当前账号不是 ${INTERNAL_NAME} 的 maintainer（无发布权限）。"
    red "  内网私服不支持命令行查权限，请到司内 npm 镜像平台确认/申请权限。"
    red "  或临时用 --skip-internal 只发外网。"
    red "如需回滚本地 tag 与 commit："
    echo "  git tag -d v${NEXT_VERSION}"
    echo "  git reset --hard HEAD~1"
    red "=================================================="
    exit 1
  fi
fi

# ---- 步骤③：内网成功后，推 commit 和 tag 到外网 ----
green "→ 推送 commit 到 ${REMOTE}/${BRANCH} ..."
git push "${REMOTE}" "${BRANCH}"

green "→ 推送 tag v${NEXT_VERSION} 到 ${REMOTE} ..."
git push "${REMOTE}" --tags

green "✓ 完成！v${NEXT_VERSION} 已发布。"
echo ""
blue "外网自动进行（无需手动操作）："
echo "  1. CNB 流水线 tag_push → git-sync 同步 tag 到 GitHub"
echo "  2. GitHub Actions 'Publish to npm' 自动运行（OIDC 可信发布）"
echo "  3. npm 上出现 ${PUBLIC_NAME}@${NEXT_VERSION}"
echo ""
echo "查看进度："
echo "  - GitHub Actions : https://github.com/cuijiawei123/smh-mcp/actions"
echo "  - 外网 npm       : https://www.npmjs.com/package/${PUBLIC_NAME}"
