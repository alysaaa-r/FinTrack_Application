// scripts/testInvite.js
const helpers = require('../utils/helpers');
const mockData = require('../utils/mockData');

function log(msg, obj) {
  console.log(msg, JSON.stringify(obj, null, 2));
}

// Create two users
const owner = { id: 'user1', name: 'OwnerUser', phone: '111', password: 'p' };
const joiner = { id: 'user2', name: 'JoinerUser', phone: '222', password: 'p' };

mockData.mockUsers.push(owner, joiner);

// Ensure owner has budgets
mockData.mockBudgets[owner.id] = {
  today: { total: 200, spent: 50 },
  week: { total: 1000, spent: 200 },
  month: { total: 4000, spent: 800 },
};

// Owner generates invite
const code = helpers.generateInviteCode();
mockData.invitationCodes[code] = { ownerId: owner.id, expiresAt: Date.now() + 5*60*1000, sharedWith: [] };

log('Created invite', { code, invite: mockData.invitationCodes[code] });

// Simulate joiner using the code
const invite = mockData.invitationCodes[code];
if (invite && invite.expiresAt > Date.now()) {
  invite.sharedWith.push(joiner.id);
  // Copy budgets
  mockData.mockBudgets[joiner.id] = JSON.parse(JSON.stringify(mockData.mockBudgets[owner.id]));
  log('After join - joiner budgets', mockData.mockBudgets[joiner.id]);
} else {
  console.log('Invite invalid or expired');
}

// verify
log('InvitationCodes', mockData.invitationCodes);

console.log('Test complete');
