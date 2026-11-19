#!/usr/bin/env bash
# Creates an admin login. Cognito emails the person a temporary password;
# they choose their own password on first sign-in at /admin.
#   scripts/create-admin.sh owner@example.com
set -euo pipefail
EMAIL="${1:?usage: create-admin.sh <email>}"
POOL=$(aws cloudformation describe-stacks --stack-name FrRenovationsStack --region us-east-1 \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" --output text)
aws cognito-idp admin-create-user --region us-east-1 --user-pool-id "$POOL" \
  --username "$EMAIL" \
  --user-attributes Name=email,Value="$EMAIL" Name=email_verified,Value=true \
  --desired-delivery-mediums EMAIL > /dev/null
echo "Invite sent to $EMAIL"
