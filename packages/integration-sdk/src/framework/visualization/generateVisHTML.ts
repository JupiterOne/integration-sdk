import { Node, Edge, Options } from 'vis';

export const nothingToDisplayMessage = 'There was no data found to visualize.';

/**
 * Creates the html to display the vis graph
 */
export function generateVisHTML(
  nodeDataSets: Node[],
  edgeDataSets: Edge[],
  options: Options = { edges: { arrows: { to: { enabled: true } } } },
) {
  const displayVisualization =
    nodeDataSets.length > 0 || edgeDataSets.length > 0;

  let content = `<h1 style="text-align: center;">${nothingToDisplayMessage}</h1>`;

  if (displayVisualization) {
    content = `<div id="integration-graph" style="height:100vh;width:100%"></div>
      <script type="text/javascript" src="https://unpkg.com/vis-network@7.6.1/standalone/umd/vis-network.min.js"></script>
      <script type="text/javascript">
        var nodes = new vis.DataSet(${JSON.stringify(nodeDataSets)});
        var edges = new vis.DataSet(${JSON.stringify(edgeDataSets)});
        // create a network
        var container = document.getElementById("integration-graph");
        var data = {
          nodes: nodes,
          edges: edges
        };
        var options = ${JSON.stringify(options)};
        var network = new vis.Network(container, data, options);
      </script>`;
  }

  return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Integration SDK Graph</title>
    </head>
    <body style="height:100vh;width:100%">
      ${content}
    </body>
    </html>`;
}
