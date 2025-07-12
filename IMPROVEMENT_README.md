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

検索結果は以下のロジックでソートされます：

1. **完了日優先**: `completed_at`が設定されているストーリーは、完了日でソート
2. **更新日フォールバック**: `completed_at`がないストーリーは、`updated_at`でソート
3. **新しい順**: どちらの場合も最新の日付が最初に表示

これにより、最近完了したストーリーや最近更新されたアクティブなストーリーを簡単に找すことができます。

## 注意事項

- `owner_id` はユーザーのUUID形式である必要があります
- デフォルトでアーカイブされたストーリーは除外されます
- 検索結果は指定した制限数に従って返されます
- ソートはサーバーから取得後にクライアント側で実行されます

この改善により、Shortcut MCPサーバーでのストーリー検索がより効率的で使いやすくなりました。
