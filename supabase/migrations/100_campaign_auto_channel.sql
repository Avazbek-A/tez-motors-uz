-- Marketing campaigns can now use the omnichannel "auto" delivery path
-- (Telegram/push/email best effort), not only direct email/SMS blasts.
alter table public.campaigns drop constraint if exists campaigns_channel_check;
alter table public.campaigns
  add constraint campaigns_channel_check check (channel in ('auto', 'email', 'sms'));
