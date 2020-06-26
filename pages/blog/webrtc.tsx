import { CodeSurfer } from '@code-surfer/standalone';
import { useSpring } from 'use-spring';
import { useState, ComponentType } from 'react';
import { Scroller, Step } from 'helpers/steps';

import t1 from '!!raw-loader!helpers/randInt';

const f1 = {
  code: t1,
  lang: 'ts',
  file: 'helpers/webrtc.ts',
};

const f2 = {
  code: t1,
  lang: 'ts',
  file: 'helpers/randInt.ts',
};

const lorem = `Lorem ipsum dolor sit amet consectetur adipisicing elit. Optio dolorum saepe unde, delectus debitis perferendis fuga facilis tempore dolor magni nam praesentium nesciunt, numquam facere ea! Amet dolorem at odit!
Recusandae corrupti quasi ea incidunt ut, sequi, saepe est ipsa consequatur placeat sed aliquam, a omnis nostrum iusto maxime expedita eligendi! Dolor aspernatur dolorem nostrum amet. Ea nam nisi voluptatibus.
Perferendis, omnis voluptatem eligendi voluptates voluptatibus, dolore incidunt consequuntur neque sint earum accusantium officiis eaque impedit odit, nobis assumenda dolores magnam. Minima et temporibus obcaecati provident soluta natus dicta libero.
Temporibus ducimus quos architecto. Sequi incidunt, impedit temporibus corrupti quia quidem et consectetur vel accusamus dolore quae optio quibusdam quos distinctio libero vitae sunt repellendus culpa accusantium provident! Excepturi, explicabo?
Quia sed quaerat delectus praesentium vel consectetur itaque sapiente ratione beatae modi? Commodi corrupti aut accusamus! Consequatur minima exercitationem quidem veniam consectetur? Excepturi eveniet a pariatur! Ratione molestias adipisci similique.
Quas, numquam! Animi at ratione quam itaque dicta magni voluptates nihil magnam quod culpa ad facilis quis repellat, molestiae quas voluptatum corporis fuga tenetur maxime id sit corrupti et inventore.
Dolores numquam ipsa quos assumenda itaque porro ea ducimus quisquam eligendi odio sunt, quia neque ex illum! Aperiam nostrum odio, ea nemo quisquam ad blanditiis, quasi facere ipsum, nam asperiores?
Voluptatem eos rem minus similique expedita placeat aliquid laboriosam neque ducimus praesentium, sed temporibus blanditiis amet aperiam alias debitis officia, odit tempore dicta exercitationem laudantium vero cumque eligendi. Adipisci, aliquam?
Quidem impedit autem magnam quae aliquam exercitationem cum odit quos laborum saepe deserunt soluta neque repudiandae provident magni molestias, possimus esse atque asperiores corporis minima natus delectus consequatur. Enim, officiis.
Commodi totam eum, vitae inventore aut voluptatibus saepe nostrum deleniti omnis obcaecati placeat soluta eos esse harum aliquam quos nesciunt vero error quaerat. Nisi cum repellendus placeat repudiandae, reprehenderit numquam!`;

type StepType = { Content: ComponentType; focus: string };

const steps: StepType[] = [
  {
    ...f1,
    focus: '144:164',
    Content: () => <p>{lorem}</p>,
  },
  {
    ...f1,
    focus: '31:37',
    Content: () => <p>{lorem}</p>,
  },
  {
    ...f1,
    focus: '31:37',
    Content: () => <p>{lorem}</p>,
  },
];

export const meta = {
  pub: true,
  title: 'Starting WebRTC',
  date: '2020-06-23T16:13:41Z',
  tags: ['meta'],
};

const Code = ({ steps, step }) => {
  const [currentStep] = useSpring(step, {
    decimals: 3,
    stiffness: 24,
    damping: 12,
  });

  return (
    <CodeSurfer
      key={steps[step]?.file}
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
        <Scroller onStepChange={(i) => setStep(i)}>
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

Post.layout = 'none';

export default Post;
