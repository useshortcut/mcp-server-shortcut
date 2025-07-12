# Project Tools Implementation for Shortcut MCP Server

## 新機能の概要

このプルリクエストでは、Shortcut MCP サーバーにプロジェクト関連の機能を追加しました。これにより、プロジェクト名からプロジェクトIDを取得し、ストーリー検索時にプロジェクト名を使用できるようになります。

## 追加された機能

### 1. ProjectTools クラス

新しい `ProjectTools` クラスが追加され、以下のツールを提供します：

#### `list-projects`
- **説明**: すべてのShortcutプロジェクトの一覧を取得
- **パラメータ**: なし
- **戻り値**: プロジェクトの配列

#### `get-project`
- **説明**: 特定のプロジェクトIDでプロジェクトを取得
- **パラメータ**: 
  - `projectId` (number): 取得するプロジェクトのID
- **戻り値**: プロジェクトの詳細

#### `search-projects`
- **説明**: プロジェクト名でプロジェクトを検索
- **パラメータ**: 
  - `name` (string, optional): 検索するプロジェクト名
- **戻り値**: マッチするプロジェクトの配列

### 2. 拡張されたストーリー検索機能

`search-stories` ツールが拡張され、プロジェクト名での検索が可能になりました：

- **変更前**: `project` パラメータは数値のみ（プロジェクトID）
- **変更後**: `project` パラメータは数値または文字列（プロジェクトIDまたはプロジェクト名）

### 3. ShortcutClientWrapper の拡張

`ShortcutClientWrapper` クラスに以下のメソッドが追加されました：

- `listProjects()`: プロジェクト一覧の取得（キャッシュ機能付き）
- `getProject(projectId)`: 特定のプロジェクトの取得
- `getProjectMap(projectIds)`: 複数のプロジェクトIDに対応するプロジェクトのマップを取得

### 4. プロジェクト名解決機能

`buildSearchQuery` 関数が拡張され、プロジェクト名を自動的にプロジェクトIDに変換する機能が追加されました：

- プロジェクト名（文字列）が指定された場合、自動的に対応するプロジェクトIDを検索
- 検索結果を使用してクエリを構築
- エラーハンドリング付き（プロジェクト名が見つからない場合は元の値を使用）

## 実装詳細

### ファイル変更

1. **新規ファイル**:
   - `src/tools/projects.ts` - ProjectToolsクラスの実装
   - `src/tools/projects.test.ts` - テストファイル

2. **変更されたファイル**:
   - `src/client/shortcut.ts` - プロジェクト関連メソッドの追加
   - `src/server.ts` - ProjectToolsの登録
   - `src/tools/stories.ts` - プロジェクト検索パラメータの拡張
   - `src/tools/utils/search.ts` - プロジェクト名解決機能の追加

### キャッシュ機能

プロジェクトデータもキャッシュされるため、頻繁なAPI呼び出しを避けることができます。

### エラーハンドリング

プロジェクト名の解決に失敗した場合でも、元の値を使用して検索を続行するため、堅牢性が向上しています。

## 使用例

### プロジェクト一覧の取得
```
list-projects
```

### プロジェクト名でのストーリー検索
```
search-stories project="My Project Name"
```

### プロジェクトIDでのストーリー検索（従来通り）
```
search-stories project=123
```

これらの機能により、ユーザーはプロジェクト名を覚えているだけでストーリー検索が可能になり、より直感的な操作が可能になります。
