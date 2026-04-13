import { ReproContext } from '@/context';

interface UIElement {
  text?: string;
  contentDescription?: string;
  resourceId?: string;
  hint?: string;
  children?: UIElement[];
}

interface LoginSelectors {
  emailField: string;
  passwordField: string;
  loginButton: string;
}

const DEFAULT_LOGIN_SELECTORS: LoginSelectors = {
  emailField: 'Email',
  passwordField: 'Password',
  loginButton: 'Sign In'
};

const EMAIL_PATTERNS = ['email', 'e-mail', 'usuario', 'username', 'user', 'login'];
const PASSWORD_PATTERNS = ['password', 'senha', 'passwd', 'pwd'];
const LOGIN_BUTTON_PATTERNS = ['entrar', 'login', 'log in', 'sign in', 'submit', 'acessar'];

export async function detectLoginFields(ctx: ReproContext): Promise<ReproContext> {
  if (!hasCredentials(ctx)) {
    return ctx;
  }

  if (!ctx.uiTree) {
    ctx.loginFlow = { ...DEFAULT_LOGIN_SELECTORS };
    return ctx;
  }

  const elements = collectElements(ctx.uiTree as UIElement);
  if (elements.length === 0) {
    ctx.loginFlow = { ...DEFAULT_LOGIN_SELECTORS };
    return ctx;
  }

  ctx.loginFlow = detectLoginFieldsFromElements(elements);
  return ctx;
}

function hasCredentials(ctx: ReproContext): boolean {
  return Boolean(ctx.credentials?.email && ctx.credentials?.password);
}

function collectElements(root: UIElement): UIElement[] {
  const collected: UIElement[] = [];
  const stack: UIElement[] = [root];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }

    collected.push(current);
    const children = current.children || [];
    for (const child of children) {
      stack.push(child);
    }
  }

  const frameChildren = (root as { frame?: { children?: UIElement[] } }).frame?.children || [];
  for (const child of frameChildren) {
    stack.push(child);
  }

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }

    collected.push(current);
    const children = current.children || [];
    for (const child of children) {
      stack.push(child);
    }
  }

  return collected;
}

function detectLoginFieldsFromElements(elements: UIElement[]): LoginSelectors {
  let emailField: string | null = null;
  let passwordField: string | null = null;
  let loginButton: string | null = null;

  for (const element of elements) {
    const selectorValue = pickSelectorValue(element);
    const normalized = selectorValue.toLowerCase();
    const normalizedId = (element.resourceId || '').toLowerCase();

    if (!emailField && includesAny(normalized, normalizedId, EMAIL_PATTERNS)) {
      emailField = selectorValue;
      continue;
    }

    if (!passwordField && includesAny(normalized, normalizedId, PASSWORD_PATTERNS)) {
      passwordField = selectorValue;
      continue;
    }

    if (!loginButton && includesAny(normalized, normalizedId, LOGIN_BUTTON_PATTERNS)) {
      loginButton = selectorValue;
    }
  }

  return {
    emailField: emailField || DEFAULT_LOGIN_SELECTORS.emailField,
    passwordField: passwordField || DEFAULT_LOGIN_SELECTORS.passwordField,
    loginButton: loginButton || DEFAULT_LOGIN_SELECTORS.loginButton
  };
}

function pickSelectorValue(element: UIElement): string {
  return element.text || element.contentDescription || element.hint || element.resourceId || '';
}

function includesAny(text: string, resourceId: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    if (text.includes(pattern) || resourceId.includes(pattern)) {
      return true;
    }
  }

  return false;
}
