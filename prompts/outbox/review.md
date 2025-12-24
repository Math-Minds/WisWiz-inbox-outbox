# Review Message Before Sending

Review the drafted message before it's sent. Check for:

## Checklist

1. **Tone**: Is it appropriate for the context?
2. **Accuracy**: Is all information correct?
3. **Clarity**: Will the recipient understand clearly?
4. **Completeness**: Does it answer all questions?
5. **Privacy**: No sensitive data that shouldn't be shared?
6. **Spelling/Grammar**: Any errors in Dutch/English?

## Message to Review

To: {{phone}} ({{contact_name}})

```
{{message_body}}
```

## Output Format

```json
{
  "approved": true|false,
  "issues": ["issue1", "issue2"],
  "suggestions": ["suggestion1"],
  "revised_message": "only if changes needed"
}
```
