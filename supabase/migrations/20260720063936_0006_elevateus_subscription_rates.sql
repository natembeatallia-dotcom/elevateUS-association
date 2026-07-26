/*
# ElevateUS — subscription rate settings defaults
Adds default subscription rate rows to organization_settings.
*/

INSERT INTO organization_settings (key, value)
VALUES
  ('subscription_monthly_rate', '2400'),
  ('subscription_annual_rate', '28800'),
  ('subscription_grace_days', '7'),
  ('subscription_late_fee', '100')
ON CONFLICT (key) DO NOTHING;
