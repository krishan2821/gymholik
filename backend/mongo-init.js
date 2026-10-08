// MongoDB initialisation script — runs once when the container is first created.
// Creates a dedicated application user with read/write access to gymdb.
db = db.getSiblingDB('gymdb');

db.createUser({
  user: 'gymadmin',
  pwd:  'gympass',
  roles: [{ role: 'readWrite', db: 'gymdb' }]
});

// Seed a SUPER_ADMIN placeholder collection so the app can tell the DB is ready
db.createCollection('_init');
print('gymdb initialised successfully');
