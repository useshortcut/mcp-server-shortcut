# ツール名の不一致問題の改善提案

## 問題の概要

AIがMCPサーバーのツールを呼び出す際に、ツール名の不一致が発生しています：

- **AI が期待するツール名**: `list_members`
- **実際に利用可能なツール名**: `shortcut_list_members` （プレフィックス付き）
- **現在の定義**: `list-members` （ハイフン形式）

## 根本原因

1. **混在したツール名形式**: 一部のツールはハイフン（`-`）、一部はアンダースコア（`_`）を使用
2. **MCPプレフィックス**: MCPサーバーが自動的に`shortcut_`プレフィックスを付加
3. **AI の期待との乖離**: AIは一般的に`_`形式を期待するが、定義は`-`形式が多い

## 改善策

### 1. 【推奨】全ツール名をアンダースコア形式に統一

```typescript
// 現在の形式（問題がある）
server.tool("list-members", ...)
server.tool("get-story", ...)
server.tool("search-stories", ...)

// 推奨する形式（統一された）
server.tool("list_members", ...)
server.tool("get_story", ...)
server.tool("search_stories", ...)
```

### 2. 影響を受けるツール一覧

以下のツールのハイフン→アンダースコアへの変更が必要：

#### Stories (stories.ts)
- `get-story-branch-name` → `get_story_branch_name`
- `get-story` → `get_story`
- `search-stories` → `search_stories`
- `search-stories-by-owner` → `search_stories_by_owner`
- `search-stories-by-mention` → `search_stories_by_mention`
- `create-story` → `create_story`
- `update-story` → `update_story`
- `assign-current-user-as-owner` → `assign_current_user_as_owner`
- `unassign-current-user-as-owner` → `unassign_current_user_as_owner`
- `create-story-comment` → `create_story_comment`
- `add-task-to-story` → `add_task_to_story`
- `add-relation-to-story` → `add_relation_to_story`
- `update-task` → `update_task`
- `add-external-link-to-story` → `add_external_link_to_story`
- `remove-external-link-from-story` → `remove_external_link_from_story`
- `get-stories-by-external-link` → `get_stories_by_external_link`
- `set-story-external-links` → `set_story_external_links`

#### Iterations (iterations.ts)
- `get-iteration-stories` → `get_iteration_stories`
- `get-iteration` → `get_iteration`
- `search-iterations` → `search_iterations`
- `create-iteration` → `create_iteration`
- `get-active-iterations` → `get_active_iterations`
- `get-upcoming-iterations` → `get_upcoming_iterations`

#### Epics (epics.ts)
- `get-epic` → `get_epic`
- `search-epics` → `search_epics`
- `create-epic` → `create_epic`

#### Objectives (objectives.ts)
- `get-objective` → `get_objective`
- `search-objectives` → `search_objectives`

#### Projects (projects.ts)
- `get-project` → `get_project`
- `list-projects` → `list_projects`
- `search-projects` → `search_projects`

#### Teams (teams.ts)
- `get-team` → `get_team`
- `list-teams` → `list_teams`

### 3. 実装の優先順位

1. **高優先度**: よく使用されるツール
   - `list_members` ✅ (既に修正済み)
   - `get_current_user` ✅ (既に修正済み)
   - `list_workflows` ✅ (既に修正済み)
   - `get_workflow` ✅ (既に修正済み)
   - `search_stories`
   - `get_story`
   - `create_story`

2. **中優先度**: 管理系ツール
   - `list_teams` ✅ (既に修正済み)
   - `get_team` ✅ (既に修正済み)
   - `list_projects`
   - `get_project`

3. **低優先度**: 特殊機能ツール
   - 外部リンク関連ツール
   - タスク関連ツール
   - リレーション関連ツール

### 4. 利点

1. **一貫性**: 全てのツール名が統一された形式になる
2. **AI互換性**: AIが期待するツール名形式と一致
3. **可読性**: プログラマーにとって理解しやすい
4. **保守性**: 将来的な変更が容易

### 5. 実装方法

#### 段階的実装
1. 重要なツールから順次変更
2. テストケースの更新
3. ドキュメントの更新
4. TROUBLESHOOTING.mdの更新

#### 一括実装
1. 自動変換スクリプトの使用
2. 全ツール名の一括変更
3. 包括的なテストの実行

### 6. 注意点

- **破壊的変更**: 既存のクライアントコードに影響
- **テストの更新**: 全てのテストケースの更新が必要
- **ドキュメントの更新**: READMEやTROUBLESHOOTINGの更新が必要

## 結論

統一されたツール名形式（アンダースコア）への変更により、AIとMCPサーバー間の相互作用がより予測可能で安定したものになります。この変更は、短期的には作業が必要ですが、長期的には開発者体験を大幅に向上させます。
