/**
 * Grant or revoke catalog-admin badge (full furniture catalog access).
 *
 *   node scripts/grant-catalog-admin.mjs --email you@example.com
 *   DSN="mongodb+srv://..." node scripts/grant-catalog-admin.mjs --email you@example.com --revoke
 */
import '../config.mjs';
import mongoose from 'mongoose';
import '../db.mjs';
import { CATALOG_ADMIN_BADGE } from '../adminUtils.mjs';

const User = mongoose.model('User');

function parseArg(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : null;
}

const email = parseArg('--email')?.trim();
const revoke = process.argv.includes('--revoke');

if (!process.env.DSN) {
  console.error('Set DSN to your Mongo connection string.');
  process.exit(1);
}
if (!email) {
  console.error('Usage: node scripts/grant-catalog-admin.mjs --email USER@EXAMPLE.COM [--revoke]');
  process.exit(1);
}

await mongoose.connect(process.env.DSN);

const user = await User.findOne({ email });
if (!user) {
  console.error(`No user with email ${email}`);
  process.exit(1);
}

if (revoke) {
  await User.updateOne({ _id: user._id }, { $pull: { badges: CATALOG_ADMIN_BADGE } });
  console.log(`Revoked ${CATALOG_ADMIN_BADGE} from ${email} (${user._id})`);
} else {
  await User.updateOne({ _id: user._id }, { $addToSet: { badges: CATALOG_ADMIN_BADGE } });
  console.log(`Granted ${CATALOG_ADMIN_BADGE} to ${email} (${user._id})`);
}

await mongoose.disconnect();
