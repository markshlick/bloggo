import { CodeSurfer } from '@code-surfer/standalone';
import { useSpring } from 'use-spring';
import { useState, ComponentType } from 'react';
import { Scroller, Step } from 'helpers/steps';

import t1 from '!!raw-loader!pages/_app.tsx';

export const meta = {
  pub: false,
  title: 'Waves playground',
  date: '2020-06-23T16:13:41Z',
  tags: ['meta'],
};

const f1 = {
  code: t1,
  lang: 'ts',
  file: 'pages/_app.tsx',
};

const lorem = `Lorem ipsum dolor sit amet consectetur, adipisicing elit. Officiis veritatis omnis, vero, recusandae consequatur assumenda quo culpa fugiat debitis iusto ut beatae distinctio! Velit itaque rem sint tempora, non eius!
Quas nisi recusandae repudiandae alias? Blanditiis illum fuga veritatis deserunt aperiam laudantium, veniam nobis nostrum, consectetur perspiciatis iusto delectus maxime sit exercitationem tenetur quod, quo accusamus vel esse quis eum.
Eius cumque ab necessitatibus iure ea doloribus aspernatur a! Cumque, ex. Perspiciatis saepe quaerat delectus quibusdam dolor cupiditate iusto pariatur reprehenderit! Id labore aliquid nobis. Dolor ex voluptatem vitae placeat.`;

type StepType = {
  Content: ComponentType;
  focus: string;
  file: string;
};

const steps: StepType[] = [
  {
    ...f1,
    focus: '1:20',
    Content: () => <p>{lorem}</p>,
  },
  {
    ...f1,
    focus: '20:40',
    Content: () => <p>{lorem}</p>,
  },
  {
    ...f1,
    focus: '40:60',
    Content: () => <p>{lorem}</p>,
  },
];

const Code = ({
  steps,
  step,
}: {
  steps: StepType[];
  step: number;
}) => {
  const config = steps[step];

  const [currentStep] = useSpring(step, {
    decimals: 3,
    stiffness: 24,
    damping: 12,
  });

  if (!config) return null;

  return (
    <CodeSurfer
      key={config?.file}
      progress={currentStep}
      steps={steps}
      nonblocking
    />
  );
};

const Post = () => {
  const [step, setStep] = useState(0);

  return (
    <div>
      <div
        key="code"
        style={{
          height: '100vh',
          width: '60vw',
          position: 'fixed',
          padding: '20px',
          boxSizing: 'border-box',
        }}
      >
        <Code step={step} steps={steps} />
      </div>
      <div
        key="content"
        style={{
          width: '40vw',
          position: 'relative',
          marginLeft: '60vw',
          padding: '20px',
          boxSizing: 'border-box',
        }}
      >
        <Scroller onStepChange={(i: number) => setStep(i)}>
          {steps.map(({ Content }, i) => (
            <Step key={i} index={i}>
              <div
                style={{
                  minHeight: '100vh',
                  marginBottom: 120,
                }}
              >
                <Content />
              </div>
            </Step>
          ))}
        </Scroller>
      </div>
    </div>
  );
};

// @ts-ignore
Post.layout = null;

export default Post;
