import { Route, Switch } from "wouter";
import PnlUpload from "./PnlUpload";
import PnlReview from "./PnlReview";
import PnlKeywordBank from "./PnlKeywordBank";

export default function PnlPipelineRoutes() {
  return (
    <Switch>
      <Route path="/modeling/pnl/upload" component={PnlUpload} />
      <Route path="/modeling/pnl/review" component={PnlReview} />
      <Route path="/modeling/pnl/keyword-bank" component={PnlKeywordBank} />
      <Route path="/modeling/pnl">{() => <PnlUpload />}</Route>
    </Switch>
  );
}

export { PnlUpload, PnlReview, PnlKeywordBank };
