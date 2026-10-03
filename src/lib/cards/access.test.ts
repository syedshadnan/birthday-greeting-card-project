import assert from 'node:assert/strict'
import { publicCardAccess } from './access'

// Paid and shared card is open to recipients.
assert.equal(publicCardAccess({ locked: false, shareEnabled: true, paid: true }), 'allowed')
// Admin lock blocks a paid, shared card.
assert.equal(publicCardAccess({ locked: true, shareEnabled: true, paid: true }), 'locked')
// Unlock restores access according to payment state.
assert.equal(publicCardAccess({ locked: false, shareEnabled: true, paid: false }), 'unpaid')
assert.equal(publicCardAccess({ locked: false, shareEnabled: false, paid: true }), 'not_shared')
