import { generateVisHTML, nothingToDisplayMessage } from '../generateVisHTML';
import { Node, Edge } from 'vis';

const nodeDataSets: Node[] = [
  { id: '1', label: 'Node 1' },
  { id: '2', label: 'Node 2' },
  { id: '3', label: 'Node 3' },
];

const edgeDataSet: Edge[] = [
  { from: '1', to: '2' },
  { from: '2', to: '3' },
  { from: '3', to: '1' },
];

test('renders html with default config', () => {
  const html = generateVisHTML(nodeDataSets, edgeDataSet);

  expect(html).toContain(
    'var options = {"edges":{"arrows":{"to":{"enabled":true}}}}',
  );
  expect(html).toMatchSnapshot();
});

test('renders custom config when passed in', () => {
  const html = generateVisHTML(nodeDataSets, edgeDataSet, {});

  expect(html).toContain('var options = {}');
  expect(html).toMatchSnapshot();
});

test('renders nothing to display message when there is nothing to display', () => {
  const html = generateVisHTML([], []);

  expect(html).toContain(nothingToDisplayMessage);
  expect(html).toMatchSnapshot();
});
