import { ReproContext } from '@/context';

export async function gatherContext(ctx: ReproContext): Promise<ReproContext> {
  console.log('   👁️ Gathering UI context...');

  ctx.uiTree = {
    screen: 'LoginScreen',
    elements: [
      { id: 'email_input', type: 'TextField', label: 'Email' },
      { id: 'password_input', type: 'TextField', label: 'Password' },
      { id: 'login_button', type: 'Button', label: 'Login' }
    ]
  };

  return ctx;
}
