interface IssueCountProps {
  count: number;
  issue: string;
}

export default function IssueCount({ count, issue }: IssueCountProps) {
  return (
    <div className="flex">
      <p className={count > 0 ? "text-red-500" : ""}>
        <span className="text-4xl">{count}</span>
        <span>
          {`${count === 1 ? `${issue}` : `${issue}s`}
                `}
        </span>
      </p>
    </div>
  );
}
