/**
 * First-principles type system for TENEX tools
 * 
 * Core philosophy:
 * - Effects as values
 * - Type safety through algebraic data types
 * - Separation of description and execution
 */

import type { Phase } from "@/conversations/phases";
import type { Agent } from "@/agents/types";
import type { NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";

// ============================================================================
// Core Effect System
// ============================================================================

/**
 * An Effect represents a computation that may fail or perform side effects.
 * This is similar to IO monad in Haskell or ZIO in Scala.
 */
export type Effect<E, A> = 
  | Pure<A>
  | Failure<E>
  | FlatMap<E, unknown, A>
  | Suspend<E, A>;

interface Pure<A> {
  readonly _tag: "Pure";
  readonly value: A;
}

interface Failure<E> {
  readonly _tag: "Failure";
  readonly error: E;
}

interface FlatMap<E, X, A> {
  readonly _tag: "FlatMap";
  readonly effect: Effect<E, X>;
  readonly f: (x: X) => Effect<E, A>;
}

interface Suspend<E, A> {
  readonly _tag: "Suspend";
  readonly effect: () => Promise<Result<E, A>>;
}

// Result type for fallible operations
export type Result<E, A> = 
  | { readonly ok: true; readonly value: A }
  | { readonly ok: false; readonly error: E };

// ============================================================================
// Tool Categories with Phantom Types
// ============================================================================

/**
 * Brand types for compile-time tool category enforcement
 */
export interface PureBrand { readonly _brand: "pure"; }
export interface EffectBrand { readonly _brand: "effect"; }
export interface ControlBrand { readonly _brand: "control"; }
export interface TerminalBrand { readonly _brand: "terminal"; }

/**
 * Context types with different capabilities
 */
export interface BaseContext {
  readonly projectPath: string;
  readonly conversationId: string;
  readonly phase: Phase;
}

export interface ExecutionContext extends BaseContext {
  readonly agentId: string;
  readonly agentName: string;
  readonly agent?: Agent;
  readonly agentSigner?: NDKPrivateKeySigner;
}

export interface ControlContext extends ExecutionContext {
  readonly isOrchestrator: true; // Only orchestrator can use control tools
  readonly availableAgents: ReadonlyArray<AgentInfo>;
}

export interface TerminalContext extends ExecutionContext {
  readonly orchestratorPubkey: string;
  readonly userPubkey: string;
}

export interface AgentInfo {
  readonly pubkey: string;
  readonly name: string;
  readonly role: string;
}

// ============================================================================
// Tool Type Definitions
// ============================================================================

/**
 * Base tool interface with phantom type for category
 */
interface BaseTool<Brand, Input, _Output> {
  readonly brand: Brand;
  readonly name: string;
  readonly description: string;
  readonly parameters: ParameterSchema<Input>;
}

/**
 * Pure tool - no side effects, deterministic output
 */
export interface PureTool<Input, Output> extends BaseTool<PureBrand, Input, Output> {
  readonly execute: (input: Validated<Input>) => Output;
}

/**
 * Effect tool - may perform side effects
 */
export interface EffectTool<Input, Output, E = ToolError> extends BaseTool<EffectBrand, Input, Output> {
  readonly execute: (input: Validated<Input>, context: ExecutionContext) => Effect<E, Output>;
}

/**
 * Control tool - affects execution flow (orchestrator only)
 */
export interface ControlTool<Input> extends BaseTool<ControlBrand, Input, ControlFlow> {
  readonly execute: (input: Validated<Input>, context: ControlContext) => Effect<ToolError, ControlFlow>;
}

/**
 * Terminal tool - ends agent execution
 */
export interface TerminalTool<Input> extends BaseTool<TerminalBrand, Input, Termination> {
  readonly execute: (input: Validated<Input>, context: TerminalContext) => Effect<ToolError, Termination>;
}

/**
 * Union of all tool types
 */
export type Tool<I = unknown, O = unknown> = 
  | PureTool<I, O>
  | EffectTool<I, O>
  | ControlTool<I>
  | TerminalTool<I>;

// ============================================================================
// Control Flow and Termination Types
// ============================================================================

/**
 * Control flow decisions that affect execution
 */
export type ControlFlow = 
  | ContinueFlow
  | DelegateFlow
  | ForkFlow;

export interface ContinueFlow {
  readonly type: "continue";
  readonly routing: RoutingDecision;
}

export interface DelegateFlow {
  readonly type: "delegate";
  readonly agents: NonEmptyArray<string>;
  readonly message: string;
  readonly returnToOrchestrator: boolean;
}

export interface ForkFlow {
  readonly type: "fork";
  readonly branches: NonEmptyArray<{
    readonly agent: string;
    readonly message: string;
  }>;
}

export interface RoutingDecision {
  readonly phase?: Phase;
  readonly destinations: NonEmptyArray<string>; // Agent pubkeys
  readonly reason: string;
  readonly message: string;
  readonly context?: Readonly<Record<string, unknown>>;
}

/**
 * Termination types that end execution
 */
export type Termination = 
  | YieldBack
  | EndConversation;

export interface YieldBack {
  readonly type: "yield_back";
  readonly completion: CompletionSummary;
}

export interface EndConversation {
  readonly type: "end_conversation";
  readonly result: ConversationResult;
}

export interface CompletionSummary {
  readonly response: string;
  readonly summary: string;
  readonly nextAgent: string;
}

export interface ConversationResult {
  readonly response: string;
  readonly summary: string;
  readonly success: boolean;
  readonly artifacts?: ReadonlyArray<string>;
}

// ============================================================================
// Parameter Schema and Validation
// ============================================================================

export interface ParameterSchema<T> {
  readonly shape: SchemaShape;
  readonly validate: (input: unknown) => Result<ValidationError, Validated<T>>;
}

export type SchemaShape = 
  | { type: "string"; description: string; enum?: ReadonlyArray<string> }
  | { type: "number"; description: string; min?: number; max?: number }
  | { type: "boolean"; description: string }
  | { type: "array"; description: string; items: SchemaShape }
  | { type: "object"; description: string; properties: Readonly<Record<string, SchemaShape>> };

// Branded type for validated input
export interface Validated<T> {
  readonly _brand: "validated";
  readonly value: T;
}

// ============================================================================
// Error Types
// ============================================================================

export type ToolError = 
  | ValidationError
  | ExecutionError
  | SystemError;

export interface ValidationError {
  readonly kind: "validation";
  readonly field: string;
  readonly message: string;
}

export interface ExecutionError {
  readonly kind: "execution";
  readonly tool: string;
  readonly message: string;
  readonly cause?: unknown;
}

export interface SystemError {
  readonly kind: "system";
  readonly message: string;
  readonly stack?: string;
}

// ============================================================================
// Helper Types
// ============================================================================

// Non-empty array type
export interface NonEmptyArray<T> extends ReadonlyArray<T> {
  readonly 0: T;
}

// Type guards
export const isPureTool = <I, O>(tool: Tool<I, O>): tool is PureTool<I, O> => 
  tool.brand._brand === "pure";

export const isEffectTool = <I, O>(tool: Tool<I, O>): tool is EffectTool<I, O> => 
  tool.brand._brand === "effect";

export const isControlTool = <I>(tool: Tool<I, unknown>): tool is ControlTool<I> => 
  tool.brand._brand === "control";

export const isTerminalTool = <I>(tool: Tool<I, unknown>): tool is TerminalTool<I> => 
  tool.brand._brand === "terminal";

export const isNonEmptyArray = <T>(array: ReadonlyArray<T>): array is NonEmptyArray<T> => 
  array.length > 0;

// ============================================================================
// Effect Constructors
// ============================================================================

export const pure = <A>(value: A): Effect<never, A> => ({
  _tag: "Pure",
  value,
});

export const fail = <E>(error: E): Effect<E, never> => ({
  _tag: "Failure",
  error,
});

export const suspend = <E, A>(effect: () => Promise<Result<E, A>>): Effect<E, A> => ({
  _tag: "Suspend",
  effect,
});

export const flatMap = <E, A, B>(
  effect: Effect<E, A>,
  f: (a: A) => Effect<E, B>
): Effect<E, B> => ({
  _tag: "FlatMap",
  effect,
  f: f as (x: unknown) => Effect<E, B>,
});

// Convenience functions
export const map = <E, A, B>(
  effect: Effect<E, A>,
  f: (a: A) => B
): Effect<E, B> => flatMap(effect, (a) => pure(f(a)));

export const chain = flatMap; // Alias for functional programmers