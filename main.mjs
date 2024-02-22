import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue } from "firebase/database";
import { onSnapshot } from "firebase/firestore";
import { createSkdb } from "skdb";

const firebaseConfig = {
  databaseURL: "https://skdb-demo-default-rtdb.firebaseio.com",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Realtime Database and get a reference to the service
(async () => {
  const skdb = await createSkdb({asWorker:false});

  await skdb.exec("CREATE TABLE json_products (v JSON);");

  const db = getDatabase();
  const dbRef = ref(db, '/');

  let data = await new Promise((resolve, reject) => onValue(dbRef, (snapshot) => resolve(snapshot.val())));

  await skdb.insertMany('json_products', data.map(x => { return {v: JSON.stringify(x)}; }));

  console.log(await skdb.exec(`SELECT * FROM json_products LIMIT 10`));

  console.log((await skdb.exec(`
  SELECT json_schema_pretty(json_infer_schema(v)) AS schema
    FROM json_products
  `)).scalarValue());

  await skdb.exec(`
    CREATE REACTIVE VIEW products AS
      json_extract(
        json_products,
        v,
        '{
           id<string>,
           brand<string>,
           title<string>,
           category<string>,
           price<int>,
           rating<num>
         }'
    );
  `);

  console.log(await skdb.schema('products'));

  await skdb.exec("CREATE UNIQUE INDEX pk_products ON products(id);");
  await skdb.exec("CREATE INDEX pk_category ON products(category);");

  await skdb.exec(`
    CREATE REACTIVE VIEW images AS 
      json_extract(
        json_products,
        v,
        '{
           id<string>,
           thumbnail<string>,
           images[]:image<string>
         }'
      )
  `);

  await skdb.exec(
    `CREATE REACTIVE VIEW top_products AS ` +
      `SELECT * from products ORDER BY rating DESC LIMIT 10;`
  );

  await skdb.exec(
    `CREATE REACTIVE VIEW most_expensive_products AS ` +
      `SELECT * FROM products ORDER BY price DESC LIMIT 10;`
  );

  await skdb.exec(`
    CREATE REACTIVE VIEW top_brands AS 
      SELECT brand, avg(rating) AS avg_rating
        FROM products
        GROUP BY brand
        ORDER BY avg_rating DESC
        LIMIT 10;
  `);

  console.log(await skdb.exec("select * from top_brands"));
})()

