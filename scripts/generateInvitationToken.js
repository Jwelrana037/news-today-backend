const crypto = require('crypto');

// নিরাপদ Random Invitation Token তৈরি
const invitationToken = crypto.randomBytes(32).toString('hex');

// Terminal-এ Token দেখানো
console.log('\nInvitation Token:');
console.log(invitationToken);

console.log('\nToken তৈরি হয়েছে। এটি গোপন রাখবে।');
