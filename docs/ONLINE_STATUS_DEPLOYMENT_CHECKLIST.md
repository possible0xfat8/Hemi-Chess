# Online Status Feature - Deployment Checklist

Complete checklist for deploying the online status feature to production.

## Pre-Deployment Checklist

### Database Preparation

- [ ] **Backup current database**
  ```bash
  pg_dump $DATABASE_URL > backup_before_online_status.sql
  ```

- [ ] **Review migration script**
  ```bash
  cat backend/migrations/001_add_online_status.sql
  ```

- [ ] **Test migration on staging database**
  ```bash
  psql $STAGING_DATABASE_URL < backend/migrations/001_add_online_status.sql
  ```

- [ ] **Verify new columns created**
  ```sql
  \d players
  -- Should show: last_seen, online_status, is_online
  ```

- [ ] **Verify indexes created**
  ```sql
  \di
  -- Should show: idx_players_online, idx_players_last_seen
  ```

### Code Review

- [ ] **Backend changes reviewed**
  - [ ] `backend/supabase.js` - New functions added
  - [ ] `backend/server.js` - WebSocket events updated
  - [ ] `backend/database.sql` - Schema updated

- [ ] **Frontend changes reviewed**
  - [ ] `src/hooks/useOnlineStatus.ts` - New hooks
  - [ ] `src/components/OnlineStatusToggle.tsx` - New component
  - [ ] `src/components/OnlineUserCount.tsx` - New component
  - [ ] `src/components/FriendsList.tsx` - Updated with status
  - [ ] `src/components/Navbar.tsx` - Added status widgets

- [ ] **Documentation reviewed**
  - [ ] `ONLINE_STATUS_UPDATES.md` - Complete documentation
  - [ ] `docs/ONLINE_STATUS_QUICK_START.md` - Quick reference
  - [ ] `docs/ONLINE_STATUS_README.md` - Summary
  - [ ] `IMPLEMENTATION_SUMMARY.md` - Implementation details

### Testing

- [ ] **Unit tests pass** (if applicable)
  ```bash
  npm test
  ```

- [ ] **Type checking passes**
  ```bash
  npm run build
  ```

- [ ] **Linting passes**
  ```bash
  npm run lint
  ```

### Manual Testing

- [ ] **Test user connection**
  - [ ] Connect wallet
  - [ ] Verify green indicator appears
  - [ ] Check database: `is_online = true`

- [ ] **Test user disconnection**
  - [ ] Disconnect/close tab
  - [ ] Verify gray indicator appears
  - [ ] Check database: `is_online = false`
  - [ ] Verify `last_seen` updated

- [ ] **Test status toggle**
  - [ ] Change to "Appear Offline"
  - [ ] Verify removed from online list
  - [ ] Verify still in friends list
  - [ ] Can still play games

- [ ] **Test online count**
  - [ ] Open multiple browsers
  - [ ] Connect different wallets
  - [ ] Verify count increases
  - [ ] Disconnect wallets
  - [ ] Verify count decreases

- [ ] **Test real-time updates**
  - [ ] Open two browsers
  - [ ] Connect User A in Browser 1
  - [ ] Verify User A shows online in Browser 2
  - [ ] Disconnect User A
  - [ ] Verify User A shows offline in Browser 2

- [ ] **Test last seen timestamps**
  - [ ] Disconnect user
  - [ ] Wait 1 minute
  - [ ] Verify shows "Last seen 1 minute ago"
  - [ ] Wait 5 minutes
  - [ ] Verify shows "Last seen 5 minutes ago"

## Deployment Steps

### Step 1: Database Migration

- [ ] **Connect to production database**
  ```bash
  psql $PRODUCTION_DATABASE_URL
  ```

- [ ] **Run migration**
  ```bash
  psql $PRODUCTION_DATABASE_URL < backend/migrations/001_add_online_status.sql
  ```

- [ ] **Verify migration success**
  ```sql
  SELECT column_name, data_type, column_default 
  FROM information_schema.columns 
  WHERE table_name = 'players' 
  AND column_name IN ('last_seen', 'online_status', 'is_online');
  ```

- [ ] **Set default values for existing users**
  ```sql
  UPDATE players 
  SET 
    last_seen = COALESCE(last_active, CURRENT_TIMESTAMP),
    online_status = 'online',
    is_online = false
  WHERE last_seen IS NULL OR online_status IS NULL OR is_online IS NULL;
  ```

### Step 2: Backend Deployment

- [ ] **Build backend**
  ```bash
  cd backend
  npm install
  ```

- [ ] **Test backend locally**
  ```bash
  npm run dev
  ```

- [ ] **Deploy backend to production**
  ```bash
  # Example for various platforms:
  # Heroku: git push heroku main
  # Railway: railway up
  # AWS: deploy via your pipeline
  ```

- [ ] **Verify backend health**
  ```bash
  curl https://your-backend.com/health
  ```

- [ ] **Check backend logs**
  ```bash
  # Look for: [SUPABASE] ✓ Client initialized
  # Look for: [REGISTER] ... registered as online
  ```

### Step 3: Frontend Deployment

- [ ] **Build frontend**
  ```bash
  npm run build
  ```

- [ ] **Test production build locally**
  ```bash
  npm run preview
  ```

- [ ] **Deploy frontend to production**
  ```bash
  # Example for various platforms:
  # Vercel: vercel --prod
  # Netlify: netlify deploy --prod
  # Cloudflare Pages: wrangler pages deploy
  ```

- [ ] **Verify frontend loads**
  - Visit production URL
  - Check for console errors
  - Verify assets loaded

### Step 4: Post-Deployment Verification

- [ ] **WebSocket connection works**
  - Open browser console
  - Check for: `[SOCKET] ✓ Connected to server`

- [ ] **Status registration works**
  - Connect wallet
  - Check console: `[SOCKET] Registered player as online`
  - Verify in database

- [ ] **Real-time updates work**
  - Open two browsers
  - Connect/disconnect users
  - Verify status updates in real-time

- [ ] **API endpoints work**
  ```bash
  # Test status preference
  curl -X POST https://your-api.com/api/user/status \
    -H "Content-Type: application/json" \
    -d '{"walletAddress":"0x...","statusPreference":"online"}'
  
  # Test get status
  curl https://your-api.com/api/user/0x.../status
  ```

- [ ] **Database queries are fast**
  ```sql
  EXPLAIN ANALYZE 
  SELECT * FROM players 
  WHERE is_online = true 
  AND online_status != 'appear_offline';
  
  -- Should use idx_players_online index
  -- Should take <50ms
  ```

## Monitoring Setup

### Metrics to Monitor

- [ ] **WebSocket Connections**
  - Active connections count
  - Connection errors
  - Reconnection rate

- [ ] **Database Performance**
  - Query latency for status updates
  - Index usage statistics
  - Connection pool utilization

- [ ] **API Response Times**
  - `/api/user/status` endpoint
  - `/api/user/:wallet/status` endpoint
  - `/api/user/heartbeat` endpoint

- [ ] **Error Rates**
  - WebSocket disconnection errors
  - Database update failures
  - API endpoint errors

### Logging Setup

- [ ] **Enable debug logging** (temporary)
  ```javascript
  // In backend/server.js
  console.log('[ONLINE_STATUS] Debug mode enabled');
  ```

- [ ] **Set up error tracking**
  - Sentry/Rollbar for error monitoring
  - Alert on status update failures
  - Alert on database connection issues

- [ ] **Set up performance monitoring**
  - New Relic/DataDog for APM
  - Track WebSocket event latency
  - Track database query performance

## Rollback Plan

### If Critical Issues Occur

- [ ] **Immediate rollback procedure**
  1. Revert frontend deployment
  2. Revert backend deployment
  3. Remove database columns (optional)

- [ ] **Rollback database changes**
  ```sql
  -- Only if absolutely necessary
  ALTER TABLE players 
  DROP COLUMN IF EXISTS last_seen,
  DROP COLUMN IF EXISTS online_status,
  DROP COLUMN IF EXISTS is_online;
  
  DROP INDEX IF EXISTS idx_players_online;
  DROP INDEX IF EXISTS idx_players_last_seen;
  ```

- [ ] **Restore from backup**
  ```bash
  psql $PRODUCTION_DATABASE_URL < backup_before_online_status.sql
  ```

### Rollback Decision Matrix

| Issue | Severity | Action |
|-------|----------|--------|
| UI glitch | Low | Fix forward, no rollback |
| WebSocket errors | Medium | Monitor, fix if <95% success |
| Database errors | High | Rollback immediately |
| Data corruption | Critical | Rollback + restore backup |

## Communication Plan

### Stakeholders to Notify

- [ ] **Before deployment**
  - [ ] Development team
  - [ ] QA team
  - [ ] Product owner
  - [ ] DevOps team

- [ ] **During deployment**
  - [ ] Post in team chat: "Deploying online status feature"
  - [ ] Update status page if using one

- [ ] **After deployment**
  - [ ] Post in team chat: "Online status feature deployed ✅"
  - [ ] Share documentation links
  - [ ] Schedule team demo

### User Communication

- [ ] **Release notes prepared**
  ```markdown
  # New Feature: Online Status 🟢
  
  - See which players are online in real-time
  - View "Last seen" for offline friends
  - Control your visibility with "Appear Offline" mode
  - Live online player count in header
  ```

- [ ] **Help documentation updated**
  - [ ] Add "How to use Online Status" guide
  - [ ] Add "Privacy Settings" section
  - [ ] Update FAQ

## Performance Benchmarks

### Acceptance Criteria

- [ ] **WebSocket latency < 100ms**
  - Test with multiple simultaneous connections
  - Measure round-trip time for status updates

- [ ] **Database queries < 50ms**
  - Test `getOnlineUsers()` with 1000+ users
  - Test status updates under load

- [ ] **API endpoints < 200ms**
  - Test all new endpoints
  - Test under concurrent load

- [ ] **UI updates < 100ms**
  - Measure time from event to UI update
  - Test with slow network conditions

## Load Testing

### Test Scenarios

- [ ] **100 simultaneous connections**
  ```bash
  # Use Artillery or similar tool
  artillery quick --count 100 --num 10 https://your-api.com
  ```

- [ ] **1000 status updates per minute**
  - Simulate users connecting/disconnecting
  - Monitor database performance

- [ ] **Stress test WebSocket broadcasts**
  - Send status updates rapidly
  - Verify all clients receive updates

## Security Checklist

- [ ] **SQL injection protection**
  - All queries use parameterized statements
  - No string concatenation in queries

- [ ] **WebSocket authentication**
  - Wallet addresses validated
  - Only users can update own status

- [ ] **Rate limiting**
  - Status updates rate limited
  - API endpoints rate limited

- [ ] **Privacy enforcement**
  - "Appear offline" respected in queries
  - No status exposed without auth

## Documentation Verification

- [ ] **All documentation complete**
  - [ ] `ONLINE_STATUS_UPDATES.md`
  - [ ] `docs/ONLINE_STATUS_QUICK_START.md`
  - [ ] `docs/ONLINE_STATUS_README.md`
  - [ ] `docs/ONLINE_STATUS_ARCHITECTURE.md`
  - [ ] `IMPLEMENTATION_SUMMARY.md`

- [ ] **Code comments updated**
  - [ ] New functions documented
  - [ ] Complex logic explained
  - [ ] TODO items tracked

- [ ] **README updated**
  - [ ] New feature listed
  - [ ] Setup instructions included
  - [ ] Environment variables documented

## Final Checklist

### Day Before Deployment

- [ ] All code merged to main branch
- [ ] All tests passing
- [ ] All documentation complete
- [ ] Stakeholders notified
- [ ] Backup plan ready
- [ ] Rollback plan tested
- [ ] Monitoring setup complete

### Day of Deployment

- [ ] Database backup created
- [ ] Team available for support
- [ ] Monitoring dashboard open
- [ ] Communication channels ready
- [ ] Deploy during low-traffic hours

### Post-Deployment (First Hour)

- [ ] Verify WebSocket connections
- [ ] Check error logs
- [ ] Monitor database performance
- [ ] Test user flows manually
- [ ] Verify real-time updates

### Post-Deployment (First Day)

- [ ] Monitor error rates
- [ ] Check user feedback
- [ ] Review performance metrics
- [ ] Fix any minor issues
- [ ] Document any learnings

### Post-Deployment (First Week)

- [ ] Review analytics
- [ ] Gather user feedback
- [ ] Optimize performance
- [ ] Plan improvements
- [ ] Update documentation

## Success Criteria

Feature is considered successfully deployed when:

- [x] ✅ All users can see online status
- [x] ✅ Real-time updates working for all users
- [x] ✅ Status toggle functional
- [x] ✅ Online count accurate
- [x] ✅ Last seen timestamps correct
- [x] ✅ No critical errors in logs
- [x] ✅ Database performance acceptable
- [x] ✅ User feedback positive
- [x] ✅ No rollback needed

## Sign-Off

### Deployment Approved By

- [ ] **Lead Developer**: _________________ Date: _______
- [ ] **QA Lead**: _________________ Date: _______
- [ ] **Product Owner**: _________________ Date: _______
- [ ] **DevOps Lead**: _________________ Date: _______

### Post-Deployment Verified By

- [ ] **Lead Developer**: _________________ Date: _______
- [ ] **QA Lead**: _________________ Date: _______

---

**Deployment Date**: _______________  
**Deployment Time**: _______________  
**Deployment By**: _______________  
**Status**: ⬜ Pending / ⬜ In Progress / ⬜ Complete / ⬜ Rolled Back
