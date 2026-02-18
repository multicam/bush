#!/bin/bash
# Usage: ./loop.sh [mode] [max_iterations]
# Examples:
#   ./loop.sh              # Build mode, unlimited iterations
#   ./loop.sh 20           # Build mode, max 20 iterations
#   ./loop.sh plan         # Plan mode, unlimited iterations
#   ./loop.sh plan 5       # Plan mode, max 5 iterations
#   ./loop.sh review       # Review mode, unlimited iterations
#   ./loop.sh review 10    # Review mode, max 10 iterations

DEFAULT_MODEL="glm-5"

# Parse arguments
if [ "$1" = "plan" ]; then
    MODE="plan"
    PROMPT_FILE="ralph-prompts/$DEFAULT_MODEL/plan.md"
    MAX_ITERATIONS=${2:-0}
elif [ "$1" = "review" ]; then
    MODE="review"
    PROMPT_FILE="ralph-prompts/$DEFAULT_MODEL/review.md"
    MAX_ITERATIONS=${2:-0}
elif [[ "$1" =~ ^[0-9]+$ ]]; then
    MODE="build"
    PROMPT_FILE="ralph-prompts/$DEFAULT_MODEL/build.md"
    MAX_ITERATIONS=$1
else
    MODE="build"
    PROMPT_FILE="ralph-prompts/$DEFAULT_MODEL/build.md"
    MAX_ITERATIONS=0
fi

ITERATION=0
CURRENT_BRANCH=$(git branch --show-current)

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Mode:   $MODE"
echo "Prompt: $PROMPT_FILE"
echo "Branch: $CURRENT_BRANCH"
[ $MAX_ITERATIONS -gt 0 ] && echo "Max:    $MAX_ITERATIONS iterations"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Verify prompt file exists
if [ ! -f "$PROMPT_FILE" ]; then
    echo "Error: $PROMPT_FILE not found"
    exit 1
fi

while true; do
    if [ $MAX_ITERATIONS -gt 0 ] && [ $ITERATION -ge $MAX_ITERATIONS ]; then
        echo "Reached max iterations: $MAX_ITERATIONS"
        break
    fi

    # Run Ralph iteration with selected prompt
    # -p: Headless mode (non-interactive, reads from stdin)
    # --dangerously-skip-permissions: Auto-approve all tool calls (YOLO mode)
    # --output-format=stream-json: Structured output for logging/monitoring
    # --model: opus for plan/review (complex reasoning), sonnet for build (speed)
    # --verbose: Detailed execution logging
    MODEL="sonnet"
    if [ "$MODE" = "plan" ] || [ "$MODE" = "review" ]; then
        MODEL="opus"
    fi

    LOG_FILE="/tmp/ralph/${MODE}-$(date +%Y%m%d-%H%M%S)-iter${ITERATION}.jsonl"
    mkdir -p /tmp/ralph
    cat "$PROMPT_FILE" | claude -p \
        --dangerously-skip-permissions \
        --output-format=stream-json \
        --model "$MODEL" \
        --verbose \
        2>&1 | tee "$LOG_FILE"

    # Commit and push changes after each iteration
    if [ -n "$(git status --porcelain)" ]; then
        git add -A
        git commit -m "Iteration $ITERATION - $MODE mode"
        git push origin "$CURRENT_BRANCH" || {
            echo "Failed to push. Setting upstream and retrying..."
            git push -u origin "$CURRENT_BRANCH"
        }
    fi

    ITERATION=$((ITERATION + 1))
    echo -e "\n\n======================== LOOP $ITERATION ========================\n"

    # In plan/review mode, check for pause gate between iterations
    # Usage: touch .pause → edit specs/REVIEW_PLAN → rm .pause
    if [ "$MODE" != "build" ] && [ -f ".pause" ]; then
        echo "Paused. Edit files, then: rm .pause"
        while [ -f ".pause" ]; do sleep 2; done
        echo "Resuming..."
    fi
done
