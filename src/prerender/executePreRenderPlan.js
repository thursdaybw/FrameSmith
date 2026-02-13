export async function executePreRenderPlan({
    plan,
    executionStrategy
}) {
    return executionStrategy.execute({ plan });
}
