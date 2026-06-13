import { ApplicationFailure } from '@temporalio/activity';
import type { StepType } from '../step.entity';
import type { FlowStepSnapshot } from '../flow.types';
import { BaseStep } from './base.step';
import { TriggerStep } from './trigger.step';
import { HttpStep } from './http.step';
import { TransformStep } from './transform.step';
import { ConditionStep } from './condition.step';
import { AgentStep } from './agent.step';
import { DelayStep } from './delay.step';
import { BrandResearchStep } from './brand-research.step';
import { MetaAdsSearchStep } from './meta-ads-search.step';
import { CreatorVetStep } from './creator-vet.step';
import { InstagramDmStep } from './instagram-dm.step';

type StepClass = new (step: FlowStepSnapshot) => BaseStep;

const stepRegistry: Partial<Record<StepType, StepClass>> & Record<string, StepClass> = {
  'trigger/manual':   TriggerStep,
  'trigger/webhook':  TriggerStep,
  'trigger/schedule': TriggerStep,
  'agent':            AgentStep,
  'http':             HttpStep,
  'transform':        TransformStep,
  'condition':        ConditionStep,
  'delay':            DelayStep,
  'brand-research':   BrandResearchStep,
  'meta-ads-search':  MetaAdsSearchStep,
  'creator-vet':      CreatorVetStep,
  'instagram-dm':     InstagramDmStep,
};

export function createStep(step: FlowStepSnapshot): BaseStep {
  const StepClass = stepRegistry[step.type];
  if (!StepClass) {
    throw ApplicationFailure.nonRetryable(`Unknown step type: ${step.type}`);
  }
  return new StepClass(step);
}

export { BaseStep, AgentStep };
