/*
# ElevateUS — leadership positions
Add a leadership_position column to profiles so the leadership team can assign
official titles (Chair, Vice Chair, Secretary, Treasurer, etc.).
*/

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS leadership_position text;
