# Classify Incoming Message

Classify the incoming WhatsApp message into one of the following categories:

## Categories

1. **question** - User is asking a question that needs an answer
2. **support** - User needs help with a problem or issue
3. **feedback** - User is providing feedback (positive or negative)
4. **booking** - User wants to schedule/book something
5. **info-request** - User requesting information about services/products
6. **greeting** - Simple greeting or social message
7. **spam** - Spam or irrelevant message
8. **other** - Doesn't fit other categories

## Input

Message from {{contact_name}} ({{phone}}):
```
{{message_body}}
```

## Output Format

```json
{
  "category": "question|support|feedback|booking|info-request|greeting|spam|other",
  "confidence": 0.0-1.0,
  "urgency": "low|medium|high",
  "requires_response": true|false,
  "suggested_tags": ["tag1", "tag2"]
}
```
