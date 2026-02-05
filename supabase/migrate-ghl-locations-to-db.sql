-- Migration script to move data from ghl-locations.json to ghl_locations table
-- Run this after creating the ghl_locations table

-- Insert existing locations from JSON file into database
-- Note: This assumes the JSON data structure matches the table schema

-- Insert the locations (you'll need to replace this with actual data from your JSON file)
-- Since we can't read files directly in SQL, you'll need to run this migration
-- through your application code or manually insert the data

-- Example insert (replace with actual data):
/*
INSERT INTO public.ghl_locations (id, name, city, state, country, address, pit_token, description, is_active)
VALUES
  ('be4yGETqzGQ4sknbwXb3', 'Youngstown Marketing Company', 'Canfield', 'OH', 'US', '110 Russo Drive', 'pit-18fcee5b-5b0c-48d1-84f6-f2f780f63ae6', 'Youngstown Marketing Company', true),
  ('LmFMkp4XCICQyJxZ2NmP', 'The Mahoning Home Buyer', 'Youngstown', 'OH', 'US', 'Youngstown, OH', 'pit-82788f45-c141-4ca4-8e8f-7c634e165a9a', 'The Mahoning Home Buyer', true),
  ('agOqs57EjbySX8vgOgAB', 'Alternabiz LLC', 'New York', 'NY', 'US', '167 Madison Avenue #205 New York NY 10016', 'pit-379e3f5b-0b5e-4808-8a61-3903180bd5f6', 'Alternabiz LLC', true),
  ('QmT69Y7kvxxol1tU8f7z', 'Amazing GraceHomeCare', 'Cleveland', 'OH', 'US', 'Cleveland', 'pit-acecb092-1b17-4437-877d-df53d7a70d70', 'Amazing GraceHomeCare', true),
  ('qlkgwbwhyFnZJseaznt5', 'ARS CONTRACTING', 'Cleveland', 'OH', 'US', 'Cleveland', 'pit-b853680d-f4b2-43ca-9878-18fc78d0d374', 'ARS CONTRACTING', true),
  ('ikoKs7PXleHTNsAYtajZ', 'ATV''S Tulum', 'Waterford', 'NY', 'US', '141 Davis Ave', 'pit-1f7fabb8-1119-461d-a349-58fdb177c89e', 'ATV''S Tulum', true),
  ('fl6qZvSghEoV572mIyOM', 'Bernies Power & Soft', 'Youngstown', 'OH', 'US', 'Youngstown, OH', 'pit-f858b21a-8681-494a-a058-06b6230d6bc3', 'Bernies Power & Soft', true),
  ('7Cy0DMyQtZncgY3hOarV', 'Beth Buys Homes', 'Youngstown', 'OH', 'US', 'Youngstown, OH', 'pit-158cd382-eab3-4bf9-82ad-63cfe86eede5', 'Beth Buys Homes', true),
  ('FCX448dRtUj0VWMzPWT0', 'Blake Buys Homes', 'Youngstown', 'OH', 'US', 'Youngstown, OH', 'pit-664e35bf-18ce-4286-9e09-118e41fb402d', 'Blake Buys Homes', true),
  ('zsoH6zAUB6YKSWCiUDjN', 'Bloom Wealth Partners', 'Youngstown', 'OH', 'US', 'Youngstown, OH', 'pit-a4210e04-cdff-4bc2-9336-ad037c966ad8', 'Bloom Wealth Partners', true),
  ('wwWN0QzriyIE8oV1YT7o', 'Choppin Throttles', '', '', 'US', 'Ohio', 'pit-6f7ce12e-ef84-4fd2-b873-8be37f2baa19', 'Choppin Throttles', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  city = EXCLUDED.city,
  state = EXCLUDED.state,
  country = EXCLUDED.country,
  address = EXCLUDED.address,
  pit_token = EXCLUDED.pit_token,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();
*/

-- After running the migration, you can verify the data was inserted:
-- SELECT COUNT(*) as total_locations FROM public.ghl_locations WHERE is_active = true;