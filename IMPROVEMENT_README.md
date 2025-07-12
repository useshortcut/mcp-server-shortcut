# Shortcut MCP Server の改善

## 問題

元のエラーメッセージで、`search_stories`ツールが見つからないというエラーが発生していました：

```
Model tried to call unavailable tool 'search_stories'. Available tools: shortcut_get-current-user, shortcut_list-members, shortcut_get-story-branch-name, shortcut_get-story, shortcut_search-stories, ...
```

## 実装した改善

### 1. 新しいツール: `search-stories-by-owner`

特定のユーザーIDがOwnerのStoryを簡単に検索できる新しいツールを追加しました。

**パラメータ:**
- `owner_id` (必須): オーナーのユーザーID (UUID)
- `state` (オプション): ワークフローステート（例: 'Done', 'In Progress'）
- `type` (オプション): ストーリータイプ（'feature', 'bug', 'chore'）
- `isDone` (オプション): 完了済みかどうか
- `isStarted` (オプション): 開始済みかどうか
- `isUnstarted` (オプション): 未開始かどうか
- `isArchived` (オプション): アーカイブ済みかどうか（デフォルト: false）
- `limit` (オプション): 最大返却数（1-100、デフォルト: 25）

**使用例:**
```javascript
// 特定のユーザーがオーナーのすべてのアクティブなストーリーを検索
await tools.searchStoriesByOwner({
  owner_id: "12345678-1234-1234-1234-123456789abc"
});

// 特定のユーザーがオーナーの完了済みbugストーリーを検索
await tools.searchStoriesByOwner({
  owner_id: "12345678-1234-1234-1234-123456789abc",
  type: "bug",
  isDone: true,
  limit: 10
});
```

### 2. 既存ツールの改善

#### `search-stories` ツールの説明を改善
- より明確な説明を追加
- エラーメッセージを改善
- **結果のスマートソート**: すべての検索結果が完了日（completed_at）優先、なければ更新日（updated_at）でソートされるように改善（新しい順）

#### `ShortcutClientWrapper` の機能拡張
- `getMember(userId)` メソッドを追加 - キャッシュからユーザー情報を取得
- `searchStories()` メソッドに `limit` パラメータを追加

### 3. エラーハンドリングの改善

- ユーザーが存在しない場合の適切なエラーメッセージ
- 検索結果が空の場合のより詳細なメッセージ
- 一般的なエラーハンドリングの強化

## 使用方法

### 基本的なOwner検索
```javascript
// 特定のユーザーのストーリーを検索
const result = await agent.call_tool("shortcut_search-stories-by-owner", {
  owner_id: "user-uuid-here"
});
```

### 条件付きOwner検索
```javascript
// 特定のユーザーの未完了のフィーチャーストーリーを検索
const result = await agent.call_tool("shortcut_search-stories-by-owner", {
  owner_id: "user-uuid-here",
  type: "feature",
  isDone: false,
  limit: 15
});
```

### 従来の柔軟な検索
```javascript
// 従来の search-stories も引き続き利用可能
const result = await agent.call_tool("shortcut_search-stories", {
  owner: "user-mention-name",
  state: "In Progress"
});
```

## 利点

1. **パフォーマンス向上**: Owner別検索が最適化され、より高速
2. **使いやすさ**: 特定のユースケース（Owner検索）に特化したシンプルなAPI
3. **エラーハンドリング**: より明確なエラーメッセージとユーザーフィードバック
4. **下位互換性**: 既存の `search-stories` ツールはそのまま利用可能
5. **スマートソート**: 完了済みストーリーは完了日、未完了ストーリーは更新日でソートされ、最新の活動を簡単に把握可能

## 実装ファイル

以下のファイルが修正されました：

- `src/tools/stories.ts` - 新しいツールとメソッドを追加
- `src/client/shortcut.ts` - クライアントラッパーの機能拡張

## ソート機能の詳細

検索結果は以下のソートオプションから選択できます：

### 1. **`updated`（デフォルト - スマートソート）**
- **完了済みストーリー**: `completed_at`（完了日）でソート
- **アクティブストーリー**: `updated_at`（最終更新日）でソート
- 新しい順（最近の意味のある活動が最初）
- **利点**: 完了後の詢字修正や整形等のノイズを除去
- **推奨用途**: 日常のタスク管理、現在の活動状況の把握

### 2. **`completed`（レガシーモード）**
- 全てのストーリーで`completed_at`（完了日）優先、なければ`updated_at`でソート
- 新しい順（最近完了/更新されたものが最初）
- **推奨用途**: 特定のユースケースでのみ使用

### 使用例
```javascript
// デフォルト: スマートソート（推奨）
{ mention_name: "mash" }

// 同じことを明示的に指定
{ mention_name: "mash", sort_by: "updated" }

// レガシーモード（非推奨）
{ mention_name: "mash", sort_by: "completed" }
```

### スマートソートの効果
完了したストーリーの詢字修正やフォーマット整形などで`updated_at`が更新されても、実際の完了日（`completed_at`）を使用することで、より意味のある時間順ソートを実現します。

## 注意事項

- `owner_id` はユーザーのUUID形式である必要があります
- デフォルトでアーカイブされたストーリーは除外されます
- 検索結果は指定した制限数に従って返されます
- ソートはサーバーから取得後にクライアント側で実行されます

この改善により、Shortcut MCPサーバーでのストーリー検索がより効率的で使いやすくなりました。
