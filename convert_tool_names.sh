#!/bin/bash

echo "=== Converting tool names from hyphens to underscores ==="

# Define the tool name mappings
declare -A tool_mappings=(
    ["get-story-branch-name"]="get_story_branch_name"
    ["get-story"]="get_story"
    ["search-stories"]="search_stories"
    ["search-stories-by-owner"]="search_stories_by_owner"
    ["search-stories-by-mention"]="search_stories_by_mention"
    ["create-story"]="create_story"
    ["update-story"]="update_story"
    ["assign-current-user-as-owner"]="assign_current_user_as_owner"
    ["unassign-current-user-as-owner"]="unassign_current_user_as_owner"
    ["create-story-comment"]="create_story_comment"
    ["add-task-to-story"]="add_task_to_story"
    ["add-relation-to-story"]="add_relation_to_story"
    ["update-task"]="update_task"
    ["add-external-link-to-story"]="add_external_link_to_story"
    ["remove-external-link-from-story"]="remove_external_link_from_story"
    ["get-stories-by-external-link"]="get_stories_by_external_link"
    ["set-story-external-links"]="set_story_external_links"
    ["get-iteration-stories"]="get_iteration_stories"
    ["get-iteration"]="get_iteration"
    ["search-iterations"]="search_iterations"
    ["create-iteration"]="create_iteration"
    ["get-active-iterations"]="get_active_iterations"
    ["get-upcoming-iterations"]="get_upcoming_iterations"
    ["get-epic"]="get_epic"
    ["search-epics"]="search_epics"
    ["create-epic"]="create_epic"
    ["get-objective"]="get_objective"
    ["search-objectives"]="search_objectives"
    ["get-project"]="get_project"
    ["list-projects"]="list_projects"
    ["search-projects"]="search_projects"
    ["get-team"]="get_team"
    ["list-teams"]="list_teams"
)

# Function to convert tool name in a file
convert_file() {
    local file="$1"
    echo "Converting $file..."
    
    # Create a backup
    cp "$file" "$file.backup"
    
    # Apply conversions
    for old_name in "${!tool_mappings[@]}"; do
        new_name="${tool_mappings[$old_name]}"
        sed -i.tmp "s/\"$old_name\"/\"$new_name\"/g" "$file"
        rm -f "$file.tmp"
    done
}

# Convert all TypeScript files in src/tools
for file in src/tools/*.ts; do
    if [[ -f "$file" ]]; then
        convert_file "$file"
    fi
done

echo "Conversion complete!"
echo "Backup files created with .backup extension"
