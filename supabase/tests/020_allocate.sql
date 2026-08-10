-- pgTAP: nido.allocate must return byte-for-byte identical results to the TypeScript
-- implementation (src/lib/money/allocate.ts) for a shared fixture set. Values here are
-- generated from that exact implementation — see src/lib/money/allocate.fixtures.ts, which
-- is the source of truth; keep the two files in sync by regenerating both together.
begin;
select plan(25);

select has_function('nido', 'allocate', array['bigint', 'numeric[]'], 'nido.allocate exists');

select is(nido.allocate(1000, array[1,1,1]::numeric[]), array[334,333,333]::bigint[], 'case 1: equal thirds');
select is(nido.allocate(100, array[1,1,1]::numeric[]), array[34,33,33]::bigint[], 'case 2: equal thirds, small');
select is(nido.allocate(5, array[1,1,1,1]::numeric[]), array[2,1,1,1]::bigint[], 'case 3: five cents, four ways');
select is(nido.allocate(12345, array[1]::numeric[]), array[12345]::bigint[], 'case 4: single participant');
select is(nido.allocate(1, array[1,1,1,1,1]::numeric[]), array[1,0,0,0,0]::bigint[], 'case 5: one cent, five ways');
select is(nido.allocate(0, array[1,1,1,1]::numeric[]), array[0,0,0,0]::bigint[], 'case 6: zero total');
select is(nido.allocate(-1000, array[1,1,1]::numeric[]), array[-334,-333,-333]::bigint[], 'case 7: negative total');
select is(nido.allocate(1000, array[2,1]::numeric[]), array[667,333]::bigint[], 'case 8: 2:1 weights');
select is(nido.allocate(10000, array[33.33,33.33,33.34]::numeric[]), array[3333,3333,3334]::bigint[], 'case 9: fractional percentage weights');
select is(nido.allocate(1000, array[1,1,0]::numeric[]), array[500,500,0]::bigint[], 'case 10: zero-weight participant');
select is(nido.allocate(9999999, array[1,1,1,1,1,1,1]::numeric[]), array[1428572,1428572,1428571,1428571,1428571,1428571,1428571]::bigint[], 'case 11: seven-way split with remainder');
select is(nido.allocate(999999999999999, array[1,1,1,1,1,1,1]::numeric[]), array[142857142857143,142857142857143,142857142857143,142857142857143,142857142857143,142857142857142,142857142857142]::bigint[], 'case 12: very large amount');
select is(nido.allocate(1, array[1]::numeric[]), array[1]::bigint[], 'case 13: one cent, one participant');
select is(nido.allocate(-1, array[1,1]::numeric[]), array[-1,0]::bigint[], 'case 14: negative one cent, two ways');
select is(nido.allocate(250, array[1,1,1,1]::numeric[]), array[63,63,62,62]::bigint[], 'case 15: 250 four ways');
select is(nido.allocate(333, array[1,1,1]::numeric[]), array[111,111,111]::bigint[], 'case 16: evenly divisible');
select is(nido.allocate(7, array[3,2,1]::numeric[]), array[4,2,1]::bigint[], 'case 17: shares-mode weights');
select is(nido.allocate(100000, array[70,30]::numeric[]), array[70000,30000]::bigint[], 'case 18: 70/30 split');
select is(nido.allocate(100000, array[50,30,20]::numeric[]), array[50000,30000,20000]::bigint[], 'case 19: three-way percentage split');
select is(nido.allocate(-12345, array[1,2,3,4]::numeric[]), array[-1235,-2469,-3703,-4938]::bigint[], 'case 20: negative amount, four increasing weights');
select is(nido.allocate(999, array[1,1,1,1,1,1,1,1,1]::numeric[]), array[111,111,111,111,111,111,111,111,111]::bigint[], 'case 21: nine-way even split');
select is(nido.allocate(2, array[1,1,1]::numeric[]), array[1,1,0]::bigint[], 'case 22: two cents, three ways');
select is(nido.allocate(100, array[1,0,0]::numeric[]), array[100,0,0]::bigint[], 'case 23: two zero-weight participants');
select is(nido.allocate(1000000, array[1,1,1,1,1,1,1,1,1,1]::numeric[]), array[100000,100000,100000,100000,100000,100000,100000,100000,100000,100000]::bigint[], 'case 24: ten-way even split');

select * from finish();
rollback;
