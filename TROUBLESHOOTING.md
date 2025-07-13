# トラブルシューティングガイド

## 元のエラーについて

元のエラーメッセージ：
```
Model tried to call unavailable tool 'search_stories'. Available tools: shortcut_get-current-user, shortcut_list-members, shortcut_get-story-branch-name, shortcut_get-story, shortcut_search-stories, ...
```

## 原因分析

このエラーは**ツール名の不一致**が原因でした：

1. **AIモデルが期待していたツール名**: `search_stories`
2. **実際に利用可能なツール名**: `shortcut_search_stories`

MCPサーバーでは、ツール名に`shortcut_`プレフィックスが付加されます。ツール名は一貫してアンダースコア（`_`）形式を使用しています。

## 解決方法

### 1. 正しいツール名を使用する

**誤った呼び出し:**
```javascript
agent.call_tool("search_stories", { ... })
```

**正しい呼び出し:**
```javascript
agent.call_tool("shortcut_search_stories", { ... })
```

### 2. 利用可能なツールを確認する

エラーメッセージに表示されている利用可能なツール一覧から正しい名前を確認してください：

```
Available tools: 
- shortcut_get_current_user
- shortcut_list_members  
- shortcut_get_story_branch_name
- shortcut_get_story
- shortcut_search_stories  ← これが正しい名前
- shortcut_create_story
- shortcut_update_story
...
```

### 3. 新しい専用ツールを使用する

Owner検索の場合は、新しく追加した専用ツールを使用することを推奨します：

```javascript
// 従来の方法（修正後）
agent.call_tool("shortcut_search-stories", {
  owner: "user-mention-name"
})

// 新しい専用ツール（推奨）
agent.call_tool("shortcut_search-stories-by-owner", {
  owner_id: "user-uuid-here"
})
```

## 一般的なMCPツール名の規則

MCPサーバーでツール名が変換される一般的なパターン：

1. **プレフィックスの追加**: サーバー名が前に付く
   - `search-stories` → `shortcut_search-stories`

2. **ハイフンとアンダースコアの変換**: 
   - ハイフン（`-`）はそのまま維持される場合が多い
   - プレフィックス部分はアンダースコア（`_`）で区切られる

3. **ケースの維持**: 
   - 元のケースが維持される

## デバッグ方法

### 1. 利用可能なツール一覧を確認

```javascript
// エラーメッセージから利用可能なツールを確認
console.log("Available tools:", error.message);
```

### 2. 正確なツール名でテスト

```javascript
try {
  const result = await agent.call_tool("shortcut_search-stories", {
    name: "test story"
  });
  console.log("Success:", result);
} catch (error) {
  console.log("Error:", error.message);
}
```

### 3. MCPサーバーの設定確認

MCPサーバーが正しく起動し、ツールが登録されているか確認してください。

## 予防策

1. **ツール名の確認**: 新しいMCPサーバーを使用する際は、必ず利用可能なツール一覧を確認する
2. **エラーメッセージの活用**: エラーメッセージに含まれる利用可能なツール一覧を参考にする
3. **ドキュメントの参照**: MCPサーバーのドキュメントで正確なツール名を確認する

## よくある問題と解決策

### Q: `shortcut_` プレフィックスが付くのはなぜ？
A: MCPの仕様により、複数のサーバーが同時に使用される際の名前空間の衝突を避けるためです。

### Q: ハイフンとアンダースコアはどちらを使うべき？
A: エラーメッセージに表示される正確な名前を使用してください。通常は元のツール定義に従います。

### Q: 古いコードが動かなくなった場合は？
A: ツール名を最新の正しい名前に更新してください。このガイドの解決方法を参考にしてください。
