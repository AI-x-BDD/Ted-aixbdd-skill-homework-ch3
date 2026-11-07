# Ignore 檔規範

## Rule 1 -- 依現有檔案與 techstack.md 偵測需要的 ignore 檔

**強度：MUST**

依下表偵測需要的 ignore 檔，偵測依據包含專案中已存在的檔案，以及 techstack.md 與 plan.md 選用的技術；實作尚未開始時專案多半是空的，必須以 techstack.md 與 plan.md 為主要依據。不得建立表中條件都不成立的 ignore 檔。

| 條件                                                     | ignore 檔                                                     |
| -------------------------------------------------------- | ------------------------------------------------------------- |
| `git rev-parse --git-dir` 成功                           | `.gitignore`                                                  |
| 存在 `Dockerfile*`，或 plan.md／techstack.md 選用 Docker | `.dockerignore`                                               |
| 存在 `.eslintrc*`                                        | `.eslintignore`                                               |
| 存在或將建立 `eslint.config.*`                           | 不建 ignore 檔，改為確認 config 的 `ignores` 涵蓋必要 pattern |
| 存在 `.prettierrc*`，或 techstack.md 選用 Prettier       | `.prettierignore`                                             |
| `package.json` 未設 `"private": true` 且要發佈到 npm     | `.npmignore`                                                  |
| 存在 `*.tf`                                              | `.terraformignore`                                            |
| 存在 Helm chart                                          | `.helmignore`                                                 |

### Good Example

這個範例在空專案依 techstack.md 偵測出 Prettier 與 ESLint flat config，`"private": true` 不發佈因此不建 `.npmignore`。

```text
git repo → .gitignore
techstack.md › 開發工具 選用 Prettier → .prettierignore
techstack.md › 開發工具 選用 ESLint 10 flat config → 確認 eslint.config.js 的 ignores
根目錄 package.json "private": true → 不建 .npmignore
```

### Bad Example

這個範例因專案目前是空的就只建 `.gitignore`，之後 Prettier 會格式化 `frontend/dist/` 的建置產物，`npm run format` 改動大量不該改的檔案。

```text
專案目前沒有任何設定檔 → 只建立 .gitignore
```

## Rule 2 -- 由任務建立的 ignore 檔交給該任務

**強度：MUST**

tasks.md 中有任務建立或修改某個 ignore 檔或 `eslint.config.*` 時，此階段不得先建立它。執行該任務時，先寫入任務指定的內容，再補上 Rule 4 對照表中缺少的 pattern；任務指定的 pattern 不得刪除或改寫。

### Good Example

這個範例的 T006 指定建立 `.gitignore`，此階段跳過，執行 T006 時先寫入任務內容再補缺少的 pattern。

```text
Phase 2：.gitignore 由 T006 建立 → 跳過
T006：寫入 node_modules/、.env、frontend/dist/（任務指定），補上 *.log、.DS_Store、Thumbs.db
```

### Bad Example

這個範例在此階段先建立完整的 `.gitignore`，執行 T006 時「建立」變成覆寫，任務指定的內容與先前補的 pattern 只剩其中一份。

```text
Phase 2：建立 .gitignore（Node.js 與 Universal pattern 全集）
T006：建立 .gitignore（node_modules/、.env、frontend/dist/）→ 覆寫
```

## Rule 3 -- 既有 ignore 檔只追加缺少的 pattern

**強度：MUST**

ignore 檔已存在時，只能在檔尾追加 Rule 4 對照表中缺少的關鍵 pattern，不得刪除、改寫或重新排序既有的行。ignore 檔不存在時，以對照表中適用技術的完整 pattern 建立。

### Good Example

這個範例只在既有 `.prettierignore` 檔尾追加缺少的兩行。

```text
既有：node_modules/、dist/
追加：coverage/、package-lock.json
```

### Bad Example

這個範例用對照表整份取代既有檔案，使用者先前手動加入的 `docs/generated/` 被刪除。

```text
以 Prettier pattern 全集覆寫 .prettierignore
```

## Rule 4 -- pattern 依 techstack.md 選用的技術取自對照表

**強度：MUST**

pattern 只能取自下表中 techstack.md 選用的語言與工具，以及 Universal；不得加入未選用技術的 pattern。

| 技術                            | pattern                                                                                                                                                |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Node.js／JavaScript／TypeScript | `node_modules/`、`dist/`、`build/`、`*.log`、`.env*`                                                                                                   |
| Python                          | `__pycache__/`、`*.pyc`、`.venv/`、`venv/`、`dist/`、`*.egg-info/`                                                                                     |
| Java                            | `target/`、`*.class`、`*.jar`、`.gradle/`、`build/`                                                                                                    |
| C#／.NET                        | `bin/`、`obj/`、`*.user`、`*.suo`、`packages/`                                                                                                         |
| Go                              | `*.exe`、`*.test`、`vendor/`、`*.out`                                                                                                                  |
| Ruby                            | `.bundle/`、`log/`、`tmp/`、`*.gem`、`vendor/bundle/`                                                                                                  |
| PHP                             | `vendor/`、`*.log`、`*.cache`、`*.env`                                                                                                                 |
| Rust                            | `target/`、`debug/`、`release/`、`*.rs.bk`、`*.rlib`、`*.prof*`、`.idea/`、`*.log`、`.env*`                                                            |
| Kotlin                          | `build/`、`out/`、`.gradle/`、`.idea/`、`*.class`、`*.jar`、`*.iml`、`*.log`、`.env*`                                                                  |
| C++                             | `build/`、`bin/`、`obj/`、`out/`、`*.o`、`*.so`、`*.a`、`*.exe`、`*.dll`、`.idea/`、`*.log`、`.env*`                                                   |
| C                               | `build/`、`bin/`、`obj/`、`out/`、`*.o`、`*.a`、`*.so`、`*.exe`、`*.dll`、`autom4te.cache/`、`config.status`、`config.log`、`.idea/`、`*.log`、`.env*` |
| Swift                           | `.build/`、`DerivedData/`、`*.swiftpm/`、`Packages/`                                                                                                   |
| R                               | `.Rproj.user/`、`.Rhistory`、`.RData`、`.Ruserdata`、`*.Rproj`、`packrat/`、`renv/`                                                                    |
| Universal                       | `.DS_Store`、`Thumbs.db`、`*.tmp`、`*.swp`、`.vscode/`、`.idea/`                                                                                       |
| Docker                          | `node_modules/`、`.git/`、`Dockerfile*`、`.dockerignore`、`*.log*`、`.env*`、`coverage/`                                                               |
| ESLint                          | `node_modules/`、`dist/`、`build/`、`coverage/`、`*.min.js`                                                                                            |
| Prettier                        | `node_modules/`、`dist/`、`build/`、`coverage/`、`package-lock.json`、`yarn.lock`、`pnpm-lock.yaml`                                                    |
| Terraform                       | `.terraform/`、`*.tfstate*`、`*.tfvars`、`.terraform.lock.hcl`                                                                                         |
| Kubernetes／k8s                 | `*.secret.yaml`、`secrets/`、`.kube/`、`kubeconfig*`、`*.key`、`*.crt`                                                                                 |

`.env*` 會連帶忽略 `.env.example`；專案需要提交 `.env.example` 時，必須同時加上 `!.env.example`。

### Good Example

這個範例的 techstack.md 只選用 Node.js，`.gitignore` 只取 Node.js 與 Universal，並保留 `.env.example`。

```text
node_modules/
dist/
build/
*.log
.env*
!.env.example
.DS_Store
Thumbs.db
*.tmp
*.swp
.vscode/
.idea/
```

### Bad Example

這個範例把所有語言的 pattern 都加入，Go 的 `vendor/` 與 C 的 `bin/` 可能誤忽略專案日後真正需要提交的目錄，`.env*` 也讓 `.env.example` 無法提交。

```text
node_modules/
vendor/
bin/
target/
.env*
```
