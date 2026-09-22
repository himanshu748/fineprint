import { runScenarios } from '@/lib/scenarios';
import baseline from '../../../../evaluation/baseline.json';
export function GET(){return Response.json({...runScenarios(),baseline:{runAt:baseline.runAt,model:baseline.model,total:baseline.total,completed:baseline.completed,passed:baseline.passed,mismatches:baseline.results.filter(r=>!r.passed).map(({name,status,expected})=>({name,status,expected}))}});}
