#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

PROJECT="testmind"
REGION="europe-west4"
GCS_BUCKET="testmind-influencer-data"

echo ""
echo "🚀 Deploying WhatsApp Sync Worker"
echo "  Project:  $PROJECT"
echo "  Region:   $REGION"
echo "  Bucket:   $GCS_BUCKET"
echo ""

# Submit build to Cloud Build
gcloud builds submit \
  --project="$PROJECT" \
  --region="$REGION" \
  --config=sync/cloudbuild.yaml \
  --substitutions="_GCS_BUCKET=$GCS_BUCKET" \
  .

echo ""
echo "✅ Deploy complete!"
echo ""
echo "⚠️  Before first run, you need to:"
echo "   1. Create GCS bucket: gsutil mb -l $REGION gs://$GCS_BUCKET"
echo "   2. Upload _index.json: gsutil cp /path/to/influencers/_index.json gs://$GCS_BUCKET/influencers/_index.json"
echo "   3. Upload existing influencer data: gsutil -m rsync -r /path/to/influencers/ gs://$GCS_BUCKET/influencers/"
echo "   4. Link WhatsApp: the first run will show QR in Cloud Run logs"
echo ""
